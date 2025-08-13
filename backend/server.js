require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./models");

const receiptRoutes = require("./routes/receiptRoutes");
const masterRoutes = require("./routes/masterRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/receipts", receiptRoutes);
app.use("/api/master", masterRoutes);

// Serve processed uploads
app.use("/processed_uploads", express.static(path.join(__dirname, "./public")));

// Serve static frontend
const distPath = path.join(__dirname, "./public");
app.use(express.static(distPath));

// Fallback to index.html for client-side routing
app.get('/', (req, res, next) => {
  if (req.method === "GET" && req.accepts("html")) {
    const indexPath = path.join(distPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        next(err);
      }
    });
  } else {
    next();
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  res.status(500).send("Something broke!");
});

// Sequelize sync + start server
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
