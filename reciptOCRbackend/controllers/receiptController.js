// backend_node/controllers/receiptController.js
const { spawn } = require("child_process");
const path = require("path");
const db = require("../models"); // Import Sequelize models

// Define the path to the Python OCR script relative to this controller
const ocrProcessorPath = path.join(__dirname, "../ocr_processor.py");

// Helper function to clean and parse number strings
const cleanAndParseNumber = (value) => {
  if (typeof value === "string" && value.trim() !== "") {
    // Remove all commas and then parse to float
    const cleanedValue = value.replace(/,/g, "");
    return parseFloat(cleanedValue) || null; // Return null if parsing fails
  }
  // Allow numbers to pass through directly if they are already numbers
  if (typeof value === "number") {
    return value;
  }
  return null; // Return null for empty strings or non-strings
};

exports.processReceipt = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const receiptImageBuffer = req.file.buffer;
  const receiptType = req.body.receipt_type || "generic";
  const filename = req.file.originalname;

  console.log(
    `[Controller] Received image: ${filename} with type: ${receiptType}`
  );

  // Spawn Python child process to perform OCR
  const pythonProcess = spawn("python", [
    ocrProcessorPath,
    receiptType,
    filename, // Make sure filename is passed to Python
  ]);

  let pythonOutput = "";
  let pythonError = "";

  // Collect data from Python script's stdout
  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });

  // Collect errors from Python script's stderr
  pythonProcess.stderr.on("data", (data) => {
    pythonError += data.toString();
  });

  pythonProcess.on("close", async (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}`);
      console.error(`Python Error: ${pythonError}`);
      try {
        const errorJson = JSON.parse(pythonError);
        return res.status(500).json(errorJson);
      } catch (e) {
        return res.status(500).json({
          error: "Failed to process image through OCR.",
          details: pythonError,
        });
      }
    }

    try {
      const result = JSON.parse(pythonOutput);
      const parsedData = result.parsed_data;

      // Create a new receipt record in the database
      const newReceipt = await db.Receipt.create({
        merchantName: parsedData.merchant_name || null,
        // Ensure date is handled correctly for TransactionDate
        transactionDate: parsedData.date || null,
        amount: cleanAndParseNumber(parsedData.total_amount),
        gasProvider: parsedData.gas_provider || null,
        gasName: parsedData.gas_name || null,
        gasAddress: parsedData.gas_address || null,
        gasTaxId: parsedData.gas_tax_id || null,
        receiptNo: parsedData.receipt_no || null,
        liters: cleanAndParseNumber(parsedData.liters),
        plateNo: parsedData.plate_no || null,
        milestone: parsedData.milestone || null,
        VAT: cleanAndParseNumber(parsedData.VAT),
        gasType: parsedData.gas_type || null,
        egatAddressTH: parsedData.egat_address_th || null,
        egatAddressENG: parsedData.egat_address_eng || null,
        egatTaxId: parsedData.egat_tax_id || null,
        // Additional fields from OCR processing
        receiptType: receiptType, // Use the type sent from frontend or generic
        rawExtractedText: result.extracted_text,
        debugImagePath: result.debug_image_url,
      });

      // Add the new receipt's ID to the parsed_data being sent back to the frontend
      result.parsed_data.db_receipt_id = newReceipt.id;

      res.json(result);
    } catch (error) {
      console.error(
        "[Controller] Error parsing Python output or saving to DB:",
        error
      );
      res.status(500).json({
        error: "Failed to parse OCR output or save receipt.",
        details: error.message,
      });
    }
  });

  // Pipe the image buffer to the Python script's stdin
  pythonProcess.stdin.write(receiptImageBuffer);
  pythonProcess.stdin.end();
};

exports.updateReceipt = async (req, res) => {
  try {
    const receiptId = req.params.id;
    const updateFields = req.body; // Incoming data from frontend (THIS IS CAMELCASE!)

    // Correctly map incoming camelCase fields from frontend to Sequelize model fields (also camelCase)
    const receiptDataToUpdate = {
      merchantName:
        updateFields.merchantName === "" ? null : updateFields.merchantName,
      transactionDate:
        updateFields.transactionDate === ""
          ? null
          : updateFields.transactionDate,
      amount: cleanAndParseNumber(updateFields.amount), // Use cleanAndParseNumber
      gasProvider:
        updateFields.gasProvider === "" ? null : updateFields.gasProvider,
      gasName: updateFields.gasName === "" ? null : updateFields.gasName,
      gasAddress:
        updateFields.gasAddress === "" ? null : updateFields.gasAddress,
      gasTaxId: updateFields.gasTaxId === "" ? null : updateFields.gasTaxId,
      receiptNo: updateFields.receiptNo === "" ? null : updateFields.receiptNo,
      liters: cleanAndParseNumber(updateFields.liters), // Use cleanAndParseNumber
      plateNo: updateFields.plateNo === "" ? null : updateFields.plateNo,
      milestone: updateFields.milestone === "" ? null : updateFields.milestone,
      VAT: cleanAndParseNumber(updateFields.VAT), // Use cleanAndParseNumber
      gasType: updateFields.gasType === "" ? null : updateFields.gasType,
      egatAddressTH:
        updateFields.egatAddressTH === "" ? null : updateFields.egatAddressTH,
      egatAddressENG:
        updateFields.egatAddressENG === "" ? null : updateFields.egatAddressENG,
      egatTaxId: updateFields.egatTaxId === "" ? null : updateFields.egatTaxId,
    };

    // Filter out undefined/null values if you only want to update changed fields
    Object.keys(receiptDataToUpdate).forEach((key) => {
      // Also consider 'N/A' from OCR as null for DB consistency
      if (
        receiptDataToUpdate[key] === undefined ||
        receiptDataToUpdate[key] === "N/A" ||
        receiptDataToUpdate[key] === ""
      ) {
        receiptDataToUpdate[key] = null;
      }
    });

    // Check if there are any actual fields to update after mapping
    const fieldsToUpdateKeys = Object.keys(receiptDataToUpdate).filter(
      (key) =>
        receiptDataToUpdate[key] !== undefined &&
        receiptDataToUpdate[key] !== null
    );

    if (fieldsToUpdateKeys.length === 0) {
      const existingReceipt = await db.Receipt.findByPk(receiptId);
      if (existingReceipt) {
        return res
          .status(200)
          .json({ message: "No changes detected for the receipt." });
      } else {
        return res.status(404).json({ error: "Receipt not found." });
      }
    }

    const [updatedRows] = await db.Receipt.update(receiptDataToUpdate, {
      where: { id: receiptId },
    });

    if (updatedRows === 0) {
      return res
        .status(404)
        .json({ error: "Receipt not found or no changes made." });
    }

    // Fetch the updated record to send back the complete, fresh data
    const updatedReceipt = await db.Receipt.findByPk(receiptId);
    res.json({
      message: "Receipt updated successfully.",
      receipt: updatedReceipt,
    });
  } catch (error) {
    console.error(
      `[Controller] Error updating receipt ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ error: `Failed to update receipt: ${error.message}` });
  }
};

exports.deleteReceipt = async (req, res) => {
  try {
    const receiptId = req.params.id;
    const deletedRows = await db.Receipt.destroy({
      where: { id: receiptId },
    });

    if (deletedRows === 0) {
      return res.status(404).json({ error: "Receipt not found." });
    }

    res.status(200).json({ message: "Receipt deleted successfully." });
  } catch (error) {
    console.error(
      `[Controller] Error deleting receipt ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ error: `Failed to delete receipt: ${error.message}` });
  }
};

// --- NEW FUNCTION: Get All Receipts ---
exports.getAllReceipts = async (req, res) => {
  try {
    const receipts = await db.Receipt.findAll();
    res.status(200).json(receipts);
  } catch (error) {
    console.error("[Controller] Error fetching all receipts:", error);
    res
      .status(500)
      .json({ error: `Failed to retrieve receipts: ${error.message}` });
  }
};

// --- NEW FUNCTION: Get Receipt by ID (if needed for a separate GET /:id route) ---
exports.getReceiptById = async (req, res) => {
  try {
    const receiptId = req.params.id;
    const receipt = await db.Receipt.findByPk(receiptId);

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found." });
    }

    res.status(200).json(receipt);
  } catch (error) {
    console.error(
      `[Controller] Error fetching receipt ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ error: `Failed to retrieve receipt: ${error.message}` });
  }
};
