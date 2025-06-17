// backend_node/controllers/receiptController.js
const { spawn } = require('child_process');
const path = require('path');
const db = require('../models'); // Import Sequelize models

// Define the path to the Python OCR script relative to this controller
const ocrProcessorPath = path.join(__dirname, '../ocr_processor.py');

/**
 * Controller function to handle receipt image processing and data saving.
 * This function triggers the Python OCR script and saves the parsed data to the database.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.processReceipt = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const receiptImageBuffer = req.file.buffer;
    const receiptType = req.body.receipt_type || 'generic';
    const filename = req.file.originalname;

    console.log(`[Controller] Received image: ${filename} with type: ${receiptType}`);

    // Spawn Python child process to perform OCR
    const pythonProcess = spawn('python', [
        ocrProcessorPath,
        receiptType,
        filename
    ]);

    let pythonOutput = '';
    let pythonError = '';

    // Collect data from Python script's stdout
    pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
    });

    // Collect errors from Python script's stderr
    pythonProcess.stderr.on('data', (data) => {
        pythonError += data.toString();
    });

    // Handle Python process close event
    pythonProcess.on('close', async (code) => {
        if (code !== 0) {
            console.error(`[Controller] Python script exited with code ${code}`);
            console.error(`[Controller] Python stderr: ${pythonError}`);
            return res.status(500).json({ error: `OCR processing failed: ${pythonError}` });
        }

        try {
            const ocrResult = JSON.parse(pythonOutput);

            const parsedData = ocrResult.parsed_data;
            const extractedText = ocrResult.extracted_text;
            const debugImageUrl = ocrResult.debug_image_url;

            // Prepare data for the Receipt model
            const receiptData = {
                // userId has been removed and is no longer required
                merchantName: parsedData.merchant_name || null,
                // Attempt to parse date, handle potential invalid date strings
                transactionDate: parsedData.date && !isNaN(new Date(parsedData.date)) ? new Date(parsedData.date) : null,
                amount: parsedData.total_amount ? parseFloat(parsedData.total_amount) : null,
                currency: parsedData.currency || 'THB', // Currency is fixed to THB
                rawExtractedText: extractedText || null,
                templateUsedForOcr: parsedData.receipt_type_used || null,
                debugImagePath: debugImageUrl || null,
                // Default values/null for other fields not extracted by OCR yet
                gasName: null,
                gasProvider: 'generic', // Placeholder, needs actual extraction logic
                receiptType: parsedData.receipt_type_used || 'generic',
                gasAddress: null,
                gasTaxId: null,
                receiptNo: null,
                liters: null,
                plateNo: null,
                milestone: null,
                VAT: null,
                gasType: null,
            };

            // Create a new Receipt record in the database
            const newReceipt = await db.Receipt.create(receiptData);
            console.log(`[Controller] Receipt saved to DB with ID: ${newReceipt.id}`);

            // Add the database receipt ID to the response for the frontend
            ocrResult.parsed_data.db_receipt_id = newReceipt.id;

            res.json(ocrResult);

        } catch (parseOrDbError) {
            console.error(`[Controller] Error parsing Python output or saving to DB: ${parseOrDbError}`);
            console.error(`[Controller] Python stdout: ${pythonOutput}`);
            return res.status(500).json({ error: `Server error after OCR: ${parseOrDbError.message}` });
        }
    });

    // Send the image buffer to Python script's stdin
    pythonProcess.stdin.write(receiptImageBuffer);
    pythonProcess.stdin.end();
};

/**
 * Controller function to get all receipts from the database.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getAllReceipts = async (req, res) => {
    try {
        const receipts = await db.Receipt.findAll({
            order: [['createdAt', 'DESC']] // Order by creation date, newest first
        });
        res.json(receipts);
    } catch (error) {
        console.error("[Controller] Error fetching all receipts:", error);
        res.status(500).json({ error: `Failed to fetch receipts: ${error.message}` });
    }
};

/**
 * Controller function to get a single receipt by its ID.
 * @param {Object} req - Express request object (expects req.params.id for receipt ID).
 * @param {Object} res - Express response object.
 */
exports.getReceiptById = async (req, res) => {
    try {
        const receiptId = req.params.id;
        const receipt = await db.Receipt.findByPk(receiptId); // Find by primary key directly

        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found.' });
        }
        res.json(receipt);
    } catch (error) {
        console.error(`[Controller] Error fetching receipt ${req.params.id}:`, error);
        res.status(500).json({ error: `Failed to fetch receipt: ${error.message}` });
    }
};

/**
 * Controller function to update an existing receipt.
 * @param {Object} req - Express request object (expects req.params.id for receipt ID, and body for updates).
 * @param {Object} res - Express response object.
 */
exports.updateReceipt = async (req, res) => {
    try {
        const receiptId = req.params.id;
        const updates = req.body; // Data to update from the frontend

        // Prevent updating sensitive fields like ID or timestamps
        delete updates.id;
        delete updates.createdAt;
        delete updates.updatedAt;

        // Ensure date is parsed if provided
        if (updates.transactionDate && !isNaN(new Date(updates.transactionDate))) {
            updates.transactionDate = new Date(updates.transactionDate);
        } else if (updates.transactionDate === '') {
            updates.transactionDate = null; // Allow clearing the date
        }

        // Ensure amounts (amount, VAT, liters) are parsed to numbers if they are provided and not empty
        if (updates.amount !== undefined && updates.amount !== null && updates.amount !== '') {
            updates.amount = parseFloat(updates.amount);
        } else {
            updates.amount = null;
        }

        if (updates.VAT !== undefined && updates.VAT !== null && updates.VAT !== '') {
            updates.VAT = parseFloat(updates.VAT);
        } else {
            updates.VAT = null;
        }

        if (updates.liters !== undefined && updates.liters !== null && updates.liters !== '') {
            updates.liters = parseFloat(updates.liters);
        } else {
            updates.liters = null;
        }

        const [updatedRows] = await db.Receipt.update(updates, {
            where: { id: receiptId }, // Update based on receipt ID
            returning: true // Return the updated rows (PostgreSQL specific)
        });

        if (updatedRows === 0) {
            // If updatedRows is 0, it means the receipt was not found or no changes were provided
            return res.status(404).json({ error: 'Receipt not found or no changes were provided.' });
        }

        // Fetch the updated receipt to return the latest state
        const updatedReceipt = await db.Receipt.findByPk(receiptId);
        res.json({ message: 'Receipt updated successfully.', receipt: updatedReceipt });
    } catch (error) {
        console.error(`[Controller] Error updating receipt ${req.params.id}:`, error);
        res.status(500).json({ error: `Failed to update receipt: ${error.message}` });
    }
};

/**
 * Controller function to delete a receipt.
 * @param {Object} req - Express request object (expects req.params.id for receipt ID).
 * @param {Object} res - Express response object.
 */
exports.deleteReceipt = async (req, res) => {
    try {
        const receiptId = req.params.id;
        const deletedRows = await db.Receipt.destroy({
            where: { id: receiptId } // Delete based on receipt ID
        });

        if (deletedRows === 0) {
            // If deletedRows is 0, it means the receipt was not found
            return res.status(404).json({ error: 'Receipt not found.' });
        }
        res.status(200).json({ message: 'Receipt deleted successfully.' });
    } catch (error) {
        console.error(`[Controller] Error deleting receipt ${req.params.id}:`, error);
        res.status(500).json({ error: `Failed to delete receipt: ${error.message}` });
    }
};
