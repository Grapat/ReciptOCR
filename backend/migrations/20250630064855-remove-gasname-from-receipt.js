'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // This is the action to remove the column
    await queryInterface.removeColumn('Receipts', 'gasName'); // 'Receipts' คือชื่อตารางใน DB, 'gasName' คือชื่อคอลัมน์
  },

  async down (queryInterface, Sequelize) {
    // This is the action to revert the change (add the column back)
    // You might need to specify the exact type and allowNull properties as per your original model
    await queryInterface.addColumn('Receipts', 'gasName', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  }
};