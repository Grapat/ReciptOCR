"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class MasterData extends Model {
    static associate(models) {
      // No direct associations for MasterData in this context
    }
  }
  MasterData.init(
    {
      // Can use UUID or a fixed string ID if it's truly a single master record
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      egatAddressTH: {
        type: DataTypes.TEXT,
        allowNull: true, // Allow null if not always present
      },
      egatAddressENG: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      egatTaxId: {
        type: DataTypes.STRING, // String for tax ID
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "MasterData",
    }
  );
  return MasterData;
};
