// utils/seed.js
const mongoose = require('mongoose');
require('dotenv').config();

const Table = require('../entities/table.entity');
const Staff = require('../entities/staff.entity');

const seedTables = async () => {
  console.log('\n ====== npm install completed ====== \n');
  console.log('🔄 [PostInstall] Starting table seeding...');
  try {
    await mongoose.connect(process.env.MONGO_URI_LOCAL);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const existingTables = await Table.countDocuments();

  try {
    if (existingTables === 0) {
      const tables = [];
      for (let i = 1; i <= 10; i++) {
        tables.push({ tableNo: i, status: 'available', capacity: 4 });
      }
      await Table.insertMany(tables);
      console.log('✅ 10 tables seeded');
      console.log('🎉 [PostInstall] Seeding completed successfully!');
    } else {
      console.log('ℹ️ Tables already exist, skipping seed');
      console.log('🎉 [PostInstall] Seeding completed successfully!');
    }
    // --- Seed Admin Staff from .env ---
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminName = process.env.SEED_ADMIN_NAME;
    const adminRole = process.env.SEED_ADMIN_ROLE;

    if (!adminEmail || !adminName || !adminRole) {
      console.warn('⚠️ Admin seed env variables missing, skipping staff seed');
    } else {
      const existingStaff = await Staff.findOne({ email: adminEmail });
      if (!existingStaff) {
        await Staff.create({
          name: adminName,
          email: adminEmail,
          role: adminRole,
        });
        console.log(`✅ Admin staff ${adminName} seeded`);
      } else {
        console.log('ℹ️ Admin staff already exists, skipping seed');
      }
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    console.log('/n--------------------------------------------/n [PostInstall Failed] please do "npm run postinstall" to continue after resolving error');
    process.exit(1);
  }
};

seedTables();