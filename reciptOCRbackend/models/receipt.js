"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Receipt extends Model {
    static associate(models) {
      // No direct associations for MasterData in this context
    }
  }
  Receipt.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      merchantName: {
        type: DataTypes.STRING,
        allowNull: true, // Allow null if OCR might fail
      },
      gasName: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      gasProvider: {
        type: DataTypes.ENUM("PTT", "Bangchak"), // Specific ENUM values
        allowNull: true,
      },
      receiptType: {
        type: DataTypes.ENUM(
          "PTT-Kbank",
          "A5",
          "Bangchak-Kbank",
          "Bangchak-Krungthai",
          "generic"
        ),
        allowNull: true,
      },
      gasAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      gasTaxId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      receiptNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      liters: {
        type: DataTypes.DECIMAL, // Use DECIMAL for exact precision for quantities
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL, // Use DECIMAL for exact precision for money
        allowNull: true,
      },
      plateNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      milestone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      VAT: {
        type: DataTypes.DECIMAL,
        allowNull: true,
      },
      gasType: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      transactionDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rawExtractedText: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      debugImagePath: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Receipt",
    }
  );
  return Receipt;
};
