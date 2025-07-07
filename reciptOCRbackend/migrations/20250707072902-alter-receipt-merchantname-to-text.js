'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Logic for applying the migration (changing column type)
    await queryInterface.changeColumn('Receipts', 'merchantName', {
      type: Sequelize.TEXT,
      allowNull: true, // Keep original allowNull constraint
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Logic for reverting the migration (changing column type back)
    // This assumes the original STRING type was without a specific length,
    // which defaults to VARCHAR(255).
    await queryInterface.changeColumn('Receipts', 'merchantName', {
      type: Sequelize.STRING, // Revert to original STRING
      allowNull: true, // Keep original allowNull constraint
    });
  }
};