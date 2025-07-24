"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // เพิ่มคอลัมน์ egatAddressTH
    await queryInterface.addColumn("Receipts", "egatAddressTH", {
      type: Sequelize.TEXT,
      allowNull: true, // กำหนดได้ว่าจะให้เป็น null ได้หรือไม่
    });

    // เพิ่มคอลัมน์ egatAddressENG
    await queryInterface.addColumn("Receipts", "egatAddressENG", {
      type: Sequelize.TEXT,
      allowNull: true, // กำหนดได้ว่าจะให้เป็น null ได้หรือไม่
    });

    await queryInterface.addColumn("Receipts", "egatTaxId", {
      type: Sequelize.STRING,
      allowNull: true, // กำหนดได้ว่าจะให้เป็น null ได้หรือไม่
    });
  },

  async down(queryInterface, Sequelize) {
    // เมื่อรัน seed:undo จะลบคอลัมน์เหล่านี้ออก
    await queryInterface.removeColumn("Receipts", "egatAddressTH");
    await queryInterface.removeColumn("Receipts", "egatAddressENG");
    await queryInterface.removeColumn("Receipts", "egatTaxId");
  },
};
