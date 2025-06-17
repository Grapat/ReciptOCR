'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {

    await queryInterface.bulkInsert('MasterData', [{
      id: 1,
      egatAddressTH: 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)\n53 หมู่ 2 ถนนจรัญสนิทวงศ์\nตำบลบางกรวย อำเภอบางกรวย\nจังหวัดนนทบุรี 11130',
      egatAddressENG: 'Electricity Generating Authority of Thailand (EGAT)\n53 Moo 2 Charan Sanit Wong Road\nBang Kruai\nNonthaburi 11130',
      egatTaxId: '0994000244843',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    // ลบข้อมูลที่ใส่เข้าไปเมื่อรัน seed:undo
    await queryInterface.bulkDelete('MasterData', null, {});
  }
};
