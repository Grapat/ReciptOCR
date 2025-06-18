// backend_node/routes/receiptRoutes.js
const express = require("express");
const multer = require("multer"); // Import multer here as it's used directly in the route
const receiptController = require("../controllers/receiptController"); // Import the controller

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Same multer config as before

// Route for processing new receipt images
// POST /api/receipts/process-image
router.post(
  "/process-image",
  upload.single("receipt_image"),
  receiptController.processReceipt
);

// --- CRUD Operations for Receipts ---

// Route to get all receipts
// GET /api/receipts/
router.get("/", receiptController.getAllReceipts);

// Route to get a single receipt by ID
// GET /api/receipts/:id
router.get("/:id", receiptController.getReceiptById);

// Route to update an existing receipt by ID
// PUT /api/receipts/:id
router.put("/:id", receiptController.updateReceipt);

// Route to delete a receipt by ID
// DELETE /api/receipts/:id
router.delete("/:id", receiptController.deleteReceipt);

module.exports = router;
