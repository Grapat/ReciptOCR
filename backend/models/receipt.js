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
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      plateNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gasProvider: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      transactionDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      taxInvNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      egatAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      egatTaxId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      milestone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL,
        allowNull: true,
      },
      liters: {
        type: DataTypes.DECIMAL, 
        allowNull: true,
      },
      pricePerLiter: {
        type: DataTypes.DECIMAL,
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
      original: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      signature: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      rawExtractedText: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageUrl: {
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
