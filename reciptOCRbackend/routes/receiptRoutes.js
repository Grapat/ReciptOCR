// routes/receiptRoutes.js
const express = require("express");
const router = express.Router();
const receiptController = require("../controllers/receiptController");

// Import multer
const multer = require("multer");

// Configure multer storage
// Use memoryStorage to get the file buffer directly, which is suitable for passing to Python
const upload = multer({ storage: multer.memoryStorage() });

// Example GET routes (เพื่อให้ครบถ้วนตามที่เราได้คุยกัน)
router.get("/", receiptController.getAllReceipts);
router.get("/:id", receiptController.getReceiptById);

// Add multer middleware to the process-image route
// 'receipt_image' must match the FormData field name used in App.jsx (formData.append('receipt_image', selectedFile))
router.post(
  "/process-image",
  upload.single("receipt_image"),
  receiptController.processReceipt
);

router.put("/:id", receiptController.updateReceipt);
router.delete("/:id", receiptController.deleteReceipt);

module.exports = router;
