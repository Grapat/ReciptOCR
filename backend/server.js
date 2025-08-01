// Load environment variables from .env file FIRST
require("dotenv").config();

// Node.js Express Server
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./models");

// Import your API routes
const receiptRoutes = require("./routes/receiptRoutes");
const masterRoutes = require("./routes/masterRoutes");

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static debug images from 'processed_uploads' folder
app.use(
  "/processed_uploads",
  express.static(path.join(__dirname, "../processed_uploads"))
);

// Middleware to parse JSON bodies (if you have other API endpoints that send JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Register API Routes ---
// All routes starting with /api/receipts will be handled by receiptRoutes
app.use("/api/receipts", receiptRoutes);
app.use("/api/master", masterRoutes);
// Catch-all for unhandled routes (optional, but good practice)
app.use((req, res, next) => {
  res.status(404).send("API endpoint not found");
});

// Global error handling middleware (optional, but recommended)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Sync Sequelize models with the database and start the server
console.log("DB_HOST:", process.env.DB_HOST);

db.sequelize
  .sync()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log("Database synced successfully.");
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });
