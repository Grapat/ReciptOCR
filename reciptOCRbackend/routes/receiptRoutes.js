// backend_node/routes/receiptRoutes.js
const express = require("express");
const multer = require("multer"); // Import multer here as it's used directly in the route
const receiptController = require("../controllers/receiptController"); // Import the controller

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Same multer config as before

router.post(
  "/process-image",
  upload.single("receipt_image"),
  receiptController.processReceipt
);


module.exports = router;
