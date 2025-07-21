// backend_node/controllers/masterController.js
const db = require("../models"); // Import Sequelize models

// Helper function to handle null/empty strings for DB consistency
const cleanField = (value) => {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return value;
};

// --- Create MasterData (or update if it already exists) ---
// This function is designed to either create the first master data record
// or update an existing one. It's not typically used for creating multiple
// master data entries unless a specific ID is provided.
exports.createMasterData = async (req, res) => {
  try {
    const { egatAddressTH, egatAddressENG, egatTaxId } = req.body;

    // Clean incoming data
    const dataToCreate = {
      egatAddressTH: cleanField(egatAddressTH),
      egatAddressENG: cleanField(egatAddressENG),
      egatTaxId: cleanField(egatTaxId),
    };

    // Find if a master data record already exists
    // Assuming there should ideally be only one master data record,
    // we'll try to find one. If not found, create. If found, update.
    let masterDataRecord = await db.MasterData.findOne();

    if (masterDataRecord) {
      // If a record exists, update it
      await masterDataRecord.update(dataToCreate);
      res.status(200).json({
        message: "Master data updated successfully.",
        masterData: masterDataRecord,
      });
    } else {
      // If no record exists, create a new one
      masterDataRecord = await db.MasterData.create(dataToCreate);
      res.status(201).json({
        message: "Master data created successfully.",
        masterData: masterDataRecord,
      });
    }
  } catch (error) {
    console.error("[Controller] Error creating/updating master data:", error);
    res.status(500).json({
      error: `Failed to create/update master data: ${error.message}`,
    });
  }
};

// --- Get All MasterData (should typically return only one record) ---
exports.getAllMasterData = async (req, res) => {
  try {
    const masterData = await db.MasterData.findAll();
    // For master data, it's often expected to return either one record or an empty array.
    res.status(200).json(masterData);
  } catch (error) {
    console.error("[Controller] Error fetching all master data:", error);
    res.status(500).json({
      error: `Failed to retrieve master data: ${error.message}`,
    });
  }
};

// --- Get MasterData by ID ---
exports.getMasterDataById = async (req, res) => {
  try {
    const masterDataId = req.params.id;
    const masterData = await db.MasterData.findByPk(masterDataId);

    if (!masterData) {
      return res.status(404).json({ error: "Master data not found." });
    }

    res.status(200).json(masterData);
  } catch (error) {
    console.error(
      `[Controller] Error fetching master data ${req.params.id}:`,
      error
    );
    res.status(500).json({
      error: `Failed to retrieve master data: ${error.message}`,
    });
  }
};

// --- Update MasterData by ID ---
exports.updateMasterData = async (req, res) => {
  try {
    const masterDataId = req.params.id;
    const updateFields = req.body;

    // Clean incoming data
    const dataToUpdate = {
      egatAddressTH: cleanField(updateFields.egatAddressTH),
      egatAddressENG: cleanField(updateFields.egatAddressENG),
      egatTaxId: cleanField(updateFields.egatTaxId),
    };

    // Filter out undefined/null values if you only want to update changed fields
    Object.keys(dataToUpdate).forEach((key) => {
      if (dataToUpdate[key] === undefined) {
        delete dataToUpdate[key]; // Remove if not provided in the request body
      }
    });

    const [updatedRows] = await db.MasterData.update(dataToUpdate, {
      where: { id: masterDataId },
    });

    if (updatedRows === 0) {
      return res
        .status(404)
        .json({ error: "Master data not found or no changes made." });
    }

    const updatedRecord = await db.MasterData.findByPk(masterDataId);
    res.json({
      message: "Master data updated successfully.",
      masterData: updatedRecord,
    });
  } catch (error) {
    console.error(
      `[Controller] Error updating master data ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ error: `Failed to update master data: ${error.message}` });
  }
};

// --- Delete MasterData by ID ---
exports.deleteMasterData = async (req, res) => {
  try {
    const masterDataId = req.params.id;
    const deletedRows = await db.MasterData.destroy({
      where: { id: masterDataId },
    });

    if (deletedRows === 0) {
      return res.status(404).json({ error: "Master data not found." });
    }

    res.status(200).json({ message: "Master data deleted successfully." });
  } catch (error) {
    console.error(
      `[Controller] Error deleting master data ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ error: `Failed to delete master data: ${error.message}` });
  }
};
