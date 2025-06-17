// Node.js Express Server
const express = require('express');
const multer = require('multer'); // For handling file uploads
const cors = require('cors'); // For Cross-Origin Resource Sharing
const { spawn } = require('child_process'); // For spawning Python process
const path = require('path'); // For path manipulation
const fs = require('fs'); // For file system operations

const app = express();
const port = 5000; // Node.js server will run on port 5000

// Configure Multer for file storage
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory

// Enable CORS for all routes
app.use(cors());

// Serve static debug images from 'processed_uploads' folder
// This allows the frontend to access debug images saved by the Python script
app.use('/processed_uploads', express.static(path.join(__dirname, '../processed_uploads')));

// Main route for processing images
app.post('/process-image', upload.single('receipt_image'), (req, res) => {
    // Check if file was uploaded
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const receiptImageBuffer = req.file.buffer; // Get image buffer from multer
    const receiptType = req.body.receipt_type || 'generic'; // Get receipt type from form data
    const filename = req.file.originalname; // Original filename

    console.log(`Received image: ${filename} with type: ${receiptType}`);

    // Spawn Python child process
    // We pass image buffer via stdin and other params as command line arguments
    const pythonProcess = spawn('python', [
        path.join(__dirname, 'ocr_processor.py'), // Path to your Python script
        receiptType,
        filename // Pass original filename for saving debug images
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
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python script exited with code ${code}`);
            console.error(`Python stderr: ${pythonError}`);
            return res.status(500).json({ error: `OCR processing failed: ${pythonError}` });
        }

        try {
            const result = JSON.parse(pythonOutput);
            res.json(result);
        } catch (parseError) {
            console.error(`Failed to parse Python output as JSON: ${parseError}`);
            console.error(`Python stdout: ${pythonOutput}`);
            return res.status(500).json({ error: `Invalid JSON from OCR script: ${pythonOutput}` });
        }
    });

    // Write the image buffer to Python script's stdin
    pythonProcess.stdin.write(receiptImageBuffer);
    pythonProcess.stdin.end(); // End the stdin stream
});

// Start the Node.js server
app.listen(port, () => {
    console.log(`Node.js server listening at http://localhost:${port}`);
});