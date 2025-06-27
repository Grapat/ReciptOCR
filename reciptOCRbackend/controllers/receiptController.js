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

  // Handle Python process close event
  pythonProcess.on("close", async (code) => {
    if (code === 0) {
      try {
        const pythonResult = JSON.parse(pythonOutput);
        console.log("[Controller] Python script output:", pythonResult);

        // Map parsed_data to your Sequelize model fields
        // Ensure field names match your receipt.js model exactly (case-sensitive)
        const receiptDataToSave = {
          merchantName: pythonResult.parsed_data.merchant_name || null,
          transactionDate: pythonResult.parsed_data.date || null, // Map 'date' to 'transactionDate'
          amount: pythonResult.parsed_data.total_amount || null, // Map 'total_amount' to 'amount'
          receiptType: pythonResult.parsed_data.receipt_type_used || null, // Changed from receiptTypeUsed to receiptType
          gasProvider: pythonResult.parsed_data.gas_provider || null,
          gasName: pythonResult.parsed_data.gas_name || null,
          gasAddress: pythonResult.parsed_data.gas_address || null,
          gasTaxId: pythonResult.parsed_data.gas_tax_id || null,
          receiptNo: pythonResult.parsed_data.receipt_no || null,
          liters: pythonResult.parsed_data.liters || null,
          plateNo: pythonResult.parsed_data.plate_no || null,
          milestone: pythonResult.parsed_data.milestone || null,
          VAT: pythonResult.parsed_data.VAT || null,
          gasType: pythonResult.parsed_data.gas_type || null,
          egatAddressTH: pythonResult.parsed_data.egat_address_th || null, // Changed from egatAddressTh to egatAddressTH
          egatAddressENG: pythonResult.parsed_data.egat_address_eng || null, // Changed from egatAddressEng to egatAddressENG
          egatTaxId: pythonResult.parsed_data.egat_tax_id || null,
          // Store raw extracted text and debug image path for reference
          extractedText: pythonResult.extracted_text,
          debugImageUrl: pythonResult.debug_image_url,
        };

        // Create a new receipt record in the database
        const newReceipt = await db.Receipt.create(receiptDataToSave);
        console.log("[Controller] New receipt saved to DB:", newReceipt.id);

        // Add the newly created receipt's ID to the parsed_data being sent back
        pythonResult.parsed_data.db_receipt_id = newReceipt.id; // CRITICAL: Add DB ID here

        res.json(pythonResult);
      } catch (parseError) {
        console.error("[Controller] Error parsing Python output:", parseError);
        console.error("[Controller] Python raw output:", pythonOutput);
        console.error("[Controller] Python errors:", pythonError);
        res.status(500).json({ error: "Failed to parse OCR output." });
      }
    } else {
      console.error(`[Controller] Python script exited with code ${code}`);
      console.error("[Controller] Python error output:", pythonError);
      res.status(500).json({
        error: `OCR processing failed. Python script exited with code ${code}. ${pythonError}`,
      });
    }
  });

  // Write the image buffer to Python's stdin
  pythonProcess.stdin.write(receiptImageBuffer);
  pythonProcess.stdin.end();
};

exports.getAllReceipts = async (req, res) => {
  try {
    const receipts = await db.Receipt.findAll();
    res.json(receipts);
  } catch (error) {
    console.error("[Controller] Error fetching receipts:", error);
    res.status(500).json({ error: "Failed to fetch receipts." });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const receipt = await db.Receipt.findByPk(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found." });
    }
    res.json(receipt);
  } catch (error) {
    console.error(`[Controller] Error fetching receipt ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch receipt." });
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
    // This expects a 'transactionDate' field in the incoming updates object
    if (updates.transactionDate && !isNaN(new Date(updates.transactionDate))) {
      updates.transactionDate = new Date(updates.transactionDate);
    } else if (updates.transactionDate === "") {
      updates.transactionDate = null;
    }

    // Ensure amounts (amount, VAT, liters, milestone) are parsed to numbers if they are provided and not empty
    // This expects an 'amount' field in the incoming updates object
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

    // Now, perform the update using Sequelize
    const [updatedRows] = await db.Receipt.update(updates, {
      where: { id: receiptId },
      returning: true, // This is for PostgreSQL, for MySQL use `returning: true` with a separate findByPk
    });

    if (updatedRows === 0) {
      // This means either the ID was not found, or the provided updates
      // resulted in no actual changes to the row (values were identical).
      // For a PUT, returning 404 for not found is appropriate.
      // If no changes were provided but ID was found, it's still a successful operation technically,
      // but returning a message might be good.
      const existingReceipt = await db.Receipt.findByPk(receiptId);
      if (existingReceipt) {
        return res.status(200).json({ message: "No changes detected for the receipt." });
      } else {
        return res.status(404).json({ error: "Receipt not found." });
      }
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

    res.json({ message: "Receipt deleted successfully." });
  } catch (error) {
    console.error(`[Controller] Error deleting receipt ${req.params.id}:`, error);
    res.status(500).json({ error: `Failed to delete receipt: ${error.message}` });
  }
};