// controllers/receiptController.js
const { spawn } = require("child_process");
const path = require("path");
const { Receipt } = require("../models");
const axios = require("axios"); // Make sure you have axios installed: npm install axios
const FormData = require("form-data");

// URL of your PHP API endpoint
const PHP_API_URL = "https://placeholder.com/upload.php";

// Function to handle the image processing
exports.processReceipt = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded." });
  }

  const receiptImageBuffer = req.file.buffer;
  const originalFilename = req.file.originalname;

  try {
    /* Step 1: Upload the image to the PHP API
    const formData = new FormData();
    formData.append("image", receiptImageBuffer, {
      filename: originalFilename,
      contentType: req.file.mimetype,
    });

    const uploadResponse = await axios.post(PHP_API_URL, formData, {
      headers: formData.getHeaders(),
    });

    const imageUrl = uploadResponse.data.imageUrl;
    console.log(`Image uploaded to PHP server: ${imageUrl}`);

    */ //Spawn the Python process with the correct arguments
    const pythonProcess = spawn("python", [
      path.join(__dirname, "..", "ocr_processor.py"),
      originalFilename,
    ]);

    let pythonData = "";
    let pythonError = "";

    // Capture stdout data from Python
    pythonProcess.stdout.on("data", (data) => {
      pythonData += data.toString();
    });

    // Capture stderr from Python for error logging
    pythonProcess.stderr.on("data", (data) => {
      pythonError += data.toString();
    });

    // Handle process exit
    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        return res
          .status(500)
          .json({ error: `Python script error: ${pythonError || "Unknown error"}` });
      }

      try {
        const parsedResult = JSON.parse(pythonData);

        // Save to database
        const newReceipt = await Receipt.create({
          extractedText: parsedResult.extracted_text,
          parsedData: parsedResult.parsed_data,
        });

        // Respond to client
        console.log("Receipt saved to database:", parsedResult.parsed_data);
        res.status(200).json({
          message: "Receipt processed and saved successfully!",
          extracted_text: parsedResult.extracted_text,
          parsed_data: parsedResult.parsed_data,
          db_receipt_id: newReceipt.id,
        });
      } catch (jsonError) {
        console.error("Failed to parse Python output or save to DB:", jsonError);
        res.status(500).json({ error: "Failed to process data from OCR script." });
      }
    });

    // Write the image buffer to the Python script's stdin and then end the stream
    pythonProcess.stdin.write(receiptImageBuffer);
    pythonProcess.stdin.end();
  } catch (error) {
    console.error("Error spawning Python process:", error);
    res.status(500).json({ error: "Failed to start OCR processing." });
  }
};

// Other receipt controller functions (as per your receiptRoutes.js)
exports.getAllReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.findAll();
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReceiptById = async (req, res) => {
  try {
    const receipt = await Receipt.findByPk(req.params.id);
    if (receipt) {
      res.json(receipt);
    } else {
      res.status(404).json({ error: "Receipt not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateReceipt = async (req, res) => {
  try {
    const [updated] = await Receipt.update(req.body, {
      where: { id: req.params.id },
    });
    if (updated) {
      const updatedReceipt = await Receipt.findByPk(req.params.id);
      res.status(200).json({ receipt: updatedReceipt });
    } else {
      res.status(404).json({ error: "Receipt not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReceipt = async (req, res) => {
  try {
    const deleted = await Receipt.destroy({
      where: { id: req.params.id },
    });
    if (deleted) {
      res.status(200).json({ message: "Receipt deleted successfully." });
    } else {
      res.status(404).json({ error: "Receipt not found." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};