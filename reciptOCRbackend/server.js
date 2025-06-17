// Node.js Express Server
const express = require("express");
const multer = require("multer"); // For handling file uploads
const cors = require("cors"); // For Cross-Origin Resource Sharing
const { spawn } = require("child_process"); // For spawning Python process
const path = require("path"); // For path manipulation
const fs = require("fs"); // For file system operations

// Import Sequelize models
const db = require("./models"); // This imports models/index.js

const app = express();
const port = 5000; // Node.js server will run on port 5000

// Configure Multer for file storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMime = ["image/jpeg", "image/png"];
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error("Only JPG and PNG files are allowed"), false);
    }
    cb(null, true);
  },
});
// Enable CORS for all routes
app.use(cors());

// Serve static debug images from 'processed_uploads' folder
// This allows the frontend to access debug images saved by the Python script
app.use(
  "/processed_uploads",
  express.static(path.join(__dirname, "../processed_uploads"))
);

// Middleware to parse JSON bodies (if you add other API endpoints)
app.use(express.json());

// Main route for processing images
app.post("/process-image", upload.single("receipt_image"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No file uploaded or invalid file type." });
  }

  const receiptImageBuffer = req.file.buffer;
  const receiptType = req.body.receipt_type || "generic";
  const filename = req.file.originalname;
  const userId = req.body.user_id || null;

  console.log(
    `Received image: ${filename}, type: ${receiptType}, userId: ${userId}`
  );

  let pythonProcess;
  try {
    pythonProcess = spawn("python", [
      path.join(__dirname, "ocr_processor.py"),
      receiptType,
      filename,
    ]);
  } catch (spawnError) {
    return res
      .status(500)
      .json({ error: `Python spawn error: ${spawnError.message}` });
  }

  let pythonOutput = "";
  let pythonError = "";

  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    pythonError += data.toString();
  });

  const timeout = setTimeout(() => {
    pythonProcess.kill("SIGKILL");
    console.error("Python script timed out.");
  }, 15000);

  pythonProcess.on("close", async (code) => {
    clearTimeout(timeout);

    if (code !== 0) {
      console.error(`Python exited with code ${code}`);
      console.error(`stderr: ${pythonError}`);
      return res.status(500).json({ error: `OCR failed: ${pythonError}` });
    }

    try {
      const result = JSON.parse(pythonOutput);

      if (!userId) {
        console.warn("No userId provided, skipping DB save.");
        return res.json(result);
      }

      const user = await db.User.findByPk(userId);
      if (!user) {
        return res
          .status(404)
          .json({ error: `User with ID ${userId} not found.` });
      }

      const receiptData = {
        userId: user.id,
        merchantName: result.parsed_data.merchant_name || null,
        transactionDate: result.parsed_data.date
          ? new Date(result.parsed_data.date)
          : null,
        amount: result.parsed_data.total_amount
          ? parseFloat(result.parsed_data.total_amount)
          : null,
        currency: result.parsed_data.currency || "THB",
        rawExtractedText: result.extracted_text || null,
        templateUsedForOcr: result.parsed_data.receipt_type_used || null,
        debugImagePath: result.debug_image_url || null,
        gasName: null,
        gasProvider: "generic",
        receiptType: result.parsed_data.receipt_type_used || "generic",
        gasAddress: null,
        gasTaxId: null,
        receiptNo: null,
        liters: null,
        plateNo: null,
        milestone: null,
        VAT: null,
        gasType: null,
      };

      const newReceipt = await db.Receipt.create(receiptData);
      console.log(`Saved receipt ID: ${newReceipt.id}`);

      result.parsed_data.db_receipt_id = newReceipt.id;
      res.json(result);
    } catch (err) {
      console.error("Error parsing Python output or saving:", err);
      console.error("Python stdout:", pythonOutput);
      res.status(500).json({ error: `Server error: ${err.message}` });
    }
  });

  pythonProcess.stdin.write(receiptImageBuffer);
  pythonProcess.stdin.end();
});

// Sync Sequelize models with the database and start the server
db.sequelize
  .sync() // This will create tables if they don't exist (use `db:migrate` for production)
  .then(() => {
    app.listen(port, () => {
      console.log(`Node.js server listening at http://localhost:${port}`);
      console.log("Database synced successfully.");
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });
