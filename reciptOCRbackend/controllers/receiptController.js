// backend_node/controllers/receiptController.js
const { spawn } = require("child_process");
const path = require("path");
const db = require("../models"); // Import Sequelize models

// Define the path to the Python OCR script relative to this controller
const ocrProcessorPath = path.join(__dirname, "../ocr_processor.py");

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

  // Handle Python process close event
  pythonProcess.on("close", async (code) => {
    if (code !== 0) {
      console.error(`[Controller] Python script exited with code ${code}`);
      console.error(`[Controller] Python stderr: ${pythonError}`);
      return res
        .status(500)
        .json({ error: `OCR processing failed: ${pythonError}` });
    }

    try {
      const ocrResult = JSON.parse(pythonOutput);

      const parsedData = ocrResult.parsed_data; // This now contains all dynamic fields including EGAT info
      const extractedText = ocrResult.extracted_text;
      const debugImageUrl = ocrResult.debug_image_url;

      // Prepare data for the Receipt model
      const receiptData = {
        merchantName: parsedData.merchant_name || null,

        // Fields from dynamic_parse_ocr
        gasName: parsedData.gas_name || null,
        gasProvider: parsedData.gas_provider || null,
        receiptType: parsedData.receipt_type_used || "generic",
        gasAddress: parsedData.gas_address || null,
        gasTaxId: parsedData.gas_tax_id || null,
        receiptNo: parsedData.receipt_no || null,
        plateNo: parsedData.plate_no || null,
        milestone: parsedData.milestone
          ? parseFloat(parsedData.milestone)
          : null,
        gasType: parsedData.gas_type || null,

        // EGAT addresses and Tax ID - now directly from OCR result in Python
        egatAddressTH: parsedData.egat_address_th || null,
        egatAddressENG: parsedData.egat_address_eng || null,
        egatTaxId: parsedData.egat_tax_id || null,

        // Original fields
        transactionDate:
          parsedData.date && !isNaN(new Date(parsedData.date))
            ? new Date(parsedData.date)
            : null,
        amount: parsedData.total_amount
          ? parseFloat(parsedData.total_amount)
          : null,
        VAT: parsedData.VAT ? parseFloat(parsedData.VAT) : null,
        liters: parsedData.liters ? parseFloat(parsedData.liters) : null,
        rawExtractedText: extractedText || null,
        templateUsedForOcr: parsedData.receipt_type_used || null,
        debugImagePath: debugImageUrl || null,
      };

      // Create a new Receipt record in the database
      const newReceipt = await db.Receipt.create(receiptData);
      console.log(`[Controller] Receipt saved to DB with ID: ${newReceipt.id}`);

      // Add the database receipt ID to the response for the frontend
      ocrResult.parsed_data.db_receipt_id = newReceipt.id;

      res.json(ocrResult);
    } catch (parseOrDbError) {
      console.error(
        `[Controller] Error parsing Python output or saving to DB: ${parseOrDbError}`
      );
      console.error(`[Controller] Python stdout: ${pythonOutput}`);
      return res
        .status(500)
        .json({ error: `Server error after OCR: ${parseOrDbError.message}` });
    }
  });

  // Send the image buffer to Python script's stdin
  pythonProcess.stdin.write(receiptImageBuffer);
  pythonProcess.stdin.end();
};

exports.getAllReceipts = async (req, res) => {
  try {
    const receipts = await db.Receipt.findAll({
      order: [["createdAt", "DESC"]], // Order by creation date, newest first
    });
    res.json(receipts);
  } catch (error) {
    console.error("[Controller] Error fetching all receipts:", error);
    res
      .status(500)
      .json({ error: `Failed to fetch receipts: ${error.message}` });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const receiptId = req.params.id;
    const receipt = await db.Receipt.findByPk(receiptId);

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found." });
    }
    res.json(receipt);
  } catch (error) {
    console.error(
      `[Controller] Error fetching receipt ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ error: `Failed to fetch receipt: ${error.message}` });
  }
};

exports.updateReceipt = async (req, res) => {
  try {
    const receiptId = req.params.id;
    const updates = req.body;

    // Prevent updating sensitive fields like ID or timestamps
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Ensure date is parsed if provided
    if (updates.transactionDate && !isNaN(new Date(updates.transactionDate))) {
      updates.transactionDate = new Date(updates.transactionDate);
    } else if (updates.transactionDate === "") {
      updates.transactionDate = null;
    }

    // Ensure amounts (amount, VAT, liters, milestone) are parsed to numbers if they are provided and not empty
    if (
      updates.amount !== undefined &&
      updates.amount !== null &&
      updates.amount !== ""
    ) {
      updates.amount = parseFloat(updates.amount);
    } else {
      updates.amount = null;
    }

    if (
      updates.VAT !== undefined &&
      updates.VAT !== null &&
      updates.VAT !== ""
    ) {
      updates.VAT = parseFloat(updates.VAT);
    } else {
      updates.VAT = null;
    }

    if (
      updates.liters !== undefined &&
      updates.liters !== null &&
      updates.liters !== ""
    ) {
      updates.liters = parseFloat(updates.liters);
    } else {
      updates.liters = null;
    }

    if (
      updates.milestone !== undefined &&
      updates.milestone !== null &&
      updates.milestone !== ""
    ) {
      updates.milestone = parseFloat(updates.milestone);
    } else {
      updates.milestone = null;
    }

    const [updatedRows] = await db.Receipt.update(updates, {
      where: { id: receiptId },
      returning: true,
    });

    if (updatedRows === 0) {
      return res
        .status(404)
        .json({ error: "Receipt not found or no changes were provided." });
    }

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
