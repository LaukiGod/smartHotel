// utils/seed.js — runs on `npm install` (postinstall) and `npm run postinstall` / `npm run seed`
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Table = require('../entities/table.entity');
const Staff = require('../entities/staff.entity');
const Dish = require('../entities/dish.entity');
const { generateTableToken } = require('./tableToken');

const dishes = require(path.join(__dirname, 'dishes.json'));

const uri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;

async function seedDishes() {
  const existingDishes = await Dish.countDocuments();
  if (existingDishes > 0) {
    console.log('ℹ️ Dishes already exist, skipping seed');
    return 0;
  }
  if (!Array.isArray(dishes) || dishes.length === 0) {
    console.warn('⚠️ utils/dishes.json is empty or invalid; no dishes to insert');
    return 0;
  }
  await Dish.insertMany(dishes);
  console.log(`✅ ${dishes.length} dishes seeded from utils/dishes.json`);
  return dishes.length;
}

const seedTables = async () => {
  if (process.env.SKIP_SEED === '1' || process.env.SKIP_SEED === 'true') {
    console.log('⏭️ [PostInstall] SKIP_SEED is set; skipping database seeding.');
    process.exit(0);
  }

  console.log('\n ====== npm postinstall / seed ====== \n');
  console.log('🔄 [PostInstall] Starting seeding (tables, staff, dishes)…');
  if (!uri) {
    console.error('❌ Set MONGO_URI_LOCAL or MONGO_URI in .env for seeding to run.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  try {
    // --- Seed Tables ---
    const existingTables = await Table.countDocuments();
    if (existingTables === 0) {
      const tables = [];
      for (let i = 1; i <= 10; i++) {
        tables.push({ tableNo: i, status: 'available', token: generateTableToken() });
      }
      await Table.insertMany(tables);
      console.log('✅ 10 tables seeded');
    } else {
      console.log('ℹ️ Tables already exist, skipping seed');
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

    // --- Seed Dishes from utils/dishes.json (postinstall) ---
    await seedDishes();

    console.log('🎉 [PostInstall] Seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    if (err.stack) console.error(err.stack);
    console.log(
      '\n--------------------------------------------\n [PostInstall Failed] fix the error, then run: npm run postinstall\n   (or: npm run seed)\n',
    );
    process.exit(1);
  }
};

seedTables();
