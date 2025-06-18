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
  const receiptType = req.body.receipt_type;
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

      console.log(
        "[Controller] OCR processed. Returning data for review, not saving to DB yet."
      );

      res.json(ocrResult); // Return the OCR result directly
    } catch (parseError) {
      console.error(`[Controller] Error parsing Python output: ${parseError}`);
      console.error(`[Controller] Python stdout: ${pythonOutput}`);
      return res
        .status(500)
        .json({ error: `Server error after OCR: ${parseError.message}` });
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
    const receipt = await db.Receipt.findByPk(receiptId); // Find by primary key directly

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
    const updates = req.body; // Data to update from the frontend

    // Prevent updating sensitive fields like ID or timestamps
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Ensure date is parsed if provided
    if (updates.transactionDate !== undefined) {
      const dateObj = new Date(updates.transactionDate);
      if (updates.transactionDate === "" || isNaN(dateObj.getTime())) {
        updates.transactionDate = null;
      } else {
        updates.transactionDate = dateObj;
      }
    }

    // Ensure amounts (amount, VAT, liters) are parsed to numbers if they are provided and not empty
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

    const [updatedRows] = await db.Receipt.update(updates, {
      where: { id: receiptId }, // Update based on receipt ID
      returning: true, // Return the updated rows (PostgreSQL specific)
    });

    if (updatedRows === 0) {
      // If updatedRows is 0, it means the receipt was not found or no changes were provided
      return res
        .status(404)
        .json({ error: "Receipt not found or no changes were provided." });
    }

    // Fetch the updated receipt to return the latest state
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
      where: { id: receiptId }, // Delete based on receipt ID
    });

    if (deletedRows === 0) {
      // If deletedRows is 0, it means the receipt was not found
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
