// utils/seed.js
const mongoose = require('mongoose');
require('dotenv').config();

const Table = require('../entities/table.entity');
const Staff = require('../entities/staff.entity');

const seed = async () => {
  console.log('\n====== PostInstall: Seeding database ======\n');

  await mongoose.connect(process.env.MONGO_URI_PROD || process.env.MONGO_URI_LOCAL);
  console.log('✅ MongoDB connected');

  // Seed tables
  if ((await Table.countDocuments()) === 0) {
    const tables = Array.from({ length: 10 }, (_, i) => ({ tableNo: i + 1, status: 'available' }));
    await Table.insertMany(tables);
    console.log('✅ 10 tables seeded');
  } else {
    console.log('ℹ️  Tables already exist, skipping');
  }

  // Seed default admin
  if ((await Staff.countDocuments()) === 0) {
    const { DEFAULT_ADMIN_EMAIL: email, DEFAULT_ADMIN_NAME: name } = process.env;
    if (!email || !name) throw new Error('Set DEFAULT_ADMIN_EMAIL & DEFAULT_ADMIN_NAME in .env to seed admin');

    await Staff.create({ name, email, role: 'ADMIN', isActive: true });
    console.log('✅ Default admin seeded');
  } else {
    console.log('ℹ️  Staff already exist, skipping');
  }
};

seed()
  .then(() => {
    console.log('\n🎉 Seeding completed!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seeding failed:', err.message);
    console.error('👉 Run "npm run postinstall" again after fixing the error');
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());