// backend_node/routes/masterRoutes.js
const express = require("express");
const router = express.Router();
const masterController = require("../controllers/masterController"); // Import the master controller

router.post("/", masterController.createMasterData);
router.get("/", masterController.getAllMasterData);
router.get("/:id", masterController.getMasterDataById);
router.put("/:id", masterController.updateMasterData);
router.delete("/:id", masterController.deleteMasterData);

module.exports = router;
