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
  const pythonProcess = spawn("python3", [
    ocrProcessorPath,
    receiptType,
    filename,
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
      // --- Date Conversion Logic ---
      let transactionDate = null;
      if (parsedData.transactionDate && parsedData.transactionDate !== "N/A") {
        const dateParts = parsedData.transactionDate.split("-");
        if (dateParts.length === 3) {
          let day = parseInt(dateParts[0], 10);
          let month = parseInt(dateParts[1], 10);
          let year = parseInt(dateParts[2], 10);

          // Convert Thai Buddhist year (BE) to Gregorian year (AD)
          // Thailand's Buddhist era is 543 years ahead of Gregorian calendar
          if (year > 2500) {
            // Simple check for Thai Buddhist year
            year -= 543;
          }

          // Create a Date object - Month is 0-indexed in JavaScript Date
          // Ensure day and month are valid numbers
          if (
            !isNaN(day) &&
            !isNaN(month) &&
            !isNaN(year) &&
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= 31
          ) {
            try {
              // Construct a date string in YYYY-MM-DD format for Sequelize
              const formattedDate = `${year}-${String(month).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              transactionDate = new Date(formattedDate); // Convert to Date object
              // Validate if the date object is valid
              if (isNaN(transactionDate.getTime())) {
                transactionDate = null; // Set to null if date is invalid after conversion
              }
            } catch (dateError) {
              console.error("Error creating Date object:", dateError);
              transactionDate = null;
            }
          }
        }
      }
      // --- End Date Conversion Logic ---

      // Remove newlines from rawExtractedText before saving to DB
      const cleanedRawExtractedText = result.extracted_text
        ? result.extracted_text.replace(/[\n\r]/g, "")
        : null;

      // Create a new receipt record in the database
      const newReceipt = await db.Receipt.create({
        plateNo: parsedData.plateNo || null,
        gasProvider: parsedData.gasProvider || null,
        transactionDate: transactionDate || null,
        taxInvNo: parsedData.taxInvNo || null,
        egatAddress: parsedData.egatAddress || parsedData.egatAddressTH || parsedData.egatAddressENG || null,
        egatTaxId: parsedData.egatTaxId || null,
        milestone: parsedData.milestone || null,
        amount: cleanAndParseNumber(parsedData.amount),
        liters: cleanAndParseNumber(parsedData.liters),
        pricePerLiter: cleanAndParseNumber(parsedData.pricePerLiter),
        VAT: cleanAndParseNumber(parsedData.VAT),
        gasType: parsedData.gasType || null,
        original: parsedData.original !== null ? parsedData.original : null,
        signature: parsedData.signature !== null ? parsedData.signature : null,
        rawExtractedText: cleanedRawExtractedText,
        // debugImagePath: result.debug_image_url,
        // imageUrl: null,
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

    const receiptDataToUpdate = {
      plateNo: updateFields.plateNo || null,
      gasProvider: updateFields.gasProvider || null,
      transactionDate: updateFields.transactionDate || null,
      taxInvNo: updateFields.taxInvNo || null,
      egatAddress: updateFields.egatAddress || null,
      egatTaxId: updateFields.egatTaxId || null,
      milestone: updateFields.milestone || null,
      amount: cleanAndParseNumber(updateFields.amount),
      liters: cleanAndParseNumber(updateFields.liters),
      pricePerLiter: cleanAndParseNumber(updateFields.pricePerLiter),
      VAT: cleanAndParseNumber(updateFields.VAT),
      gasType: updateFields.gasType || null,
      original: updateFields.original !== null ? updateFields.original : null,
      signature: updateFields.signature !== null ? updateFields.signature : null,
    };

    // Filter out undefined/null values
    Object.keys(receiptDataToUpdate).forEach(key => {
      if (receiptDataToUpdate[key] === undefined || receiptDataToUpdate[key] === "N/A" || receiptDataToUpdate[key] === "") {
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