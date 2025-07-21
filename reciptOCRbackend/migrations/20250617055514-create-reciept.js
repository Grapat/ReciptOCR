"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Receipts table
    await queryInterface.createTable("Receipts", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      merchantName: {
        type: Sequelize.STRING,
      },
      gasName: {
        // Note: 'gasName' is included here if it was part of the *initial* schema.
        // It will then be removed by the 'remove-gasname-from-receipt' migration.
        // Ensure this matches your model definition's state at the very beginning.
        type: Sequelize.STRING(50),
      },
      gasProvider: {
        type: Sequelize.ENUM("PTT", "Bangchak"),
      },
      receiptType: {
        type: Sequelize.ENUM(
          "PTT-Kbank",
          "A5",
          "Bangchak-Kbank",
          "Bangchak-Krungthai",
          "generic"
        ),
      },
      gasAddress: {
        type: Sequelize.TEXT,
      },
      gasTaxId: {
        type: Sequelize.STRING,
      },
      receiptNo: {
        type: Sequelize.STRING,
      },
      liters: {
        type: Sequelize.DECIMAL,
      },
      amount: {
        type: Sequelize.DECIMAL,
      },
      plateNo: {
        type: Sequelize.STRING,
      },
      milestone: {
        type: Sequelize.STRING,
      },
      VAT: {
        type: Sequelize.DECIMAL,
      },
      gasType: {
        type: Sequelize.STRING(20),
      },
      transactionDate: {
        type: Sequelize.DATE, // For the date on the receipt
      },
      rawExtractedText: {
        type: Sequelize.TEXT,
      },
      debugImagePath: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Create the MasterData table
    await queryInterface.createTable("MasterData", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      egatAddressTH: {
        type: Sequelize.TEXT,
      },
      egatAddressENG: {
        type: Sequelize.TEXT,
      },
      egatTaxId: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order of creation if they depend on each other
    // In this case, they are independent.
    await queryInterface.dropTable("MasterData");
    await queryInterface.dropTable("Receipts");
  },
};
