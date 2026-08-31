// utils/seed.js — runs on `npm install` (postinstall) and `npm run seed`
//
// In multi-tenant mode there is nothing global left to seed except the platform
// itself. Tables, dishes and staff now belong to a restaurant, and are created
// by `provisionRestaurant` when that restaurant is added from the platform
// console (or by SEED_RESTAURANT_* below, for a one-command dev setup).
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Staff = require('../entities/staff.entity');
const Restaurant = require('../entities/restaurant.entity');
const { provisionRestaurant } = require('./tenantProvision');

const uri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;

async function seedPlatformAdmin() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || '').toLowerCase().trim();
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

  if (!email) {
    console.warn('⚠️  PLATFORM_ADMIN_EMAIL not set — skipping platform admin seed.');
    console.warn('    Without it nobody can sign in to /platform to create restaurants.');
    return null;
  }

  const existing = await Staff.findOne({ restaurant: null, email });
  if (existing) {
    console.log(`ℹ️  Platform admin ${email} already exists`);
    return existing;
  }

  const admin = await Staff.create({ name, email, role: 'SUPER_ADMIN', restaurant: null });
  console.log(`✅ Platform admin seeded: ${email}`);
  return admin;
}

async function seedFirstRestaurant() {
  const name = process.env.SEED_RESTAURANT_NAME;
  if (!name) {
    console.log('ℹ️  SEED_RESTAURANT_NAME not set — no demo restaurant created.');
    return null;
  }

  const slug = process.env.SEED_RESTAURANT_SLUG || undefined;
  if (slug && (await Restaurant.exists({ slug }))) {
    console.log(`ℹ️  Restaurant "${slug}" already exists, skipping`);
    return null;
  }

  const { restaurant, seeded } = await provisionRestaurant({
    name,
    slug,
    adminName: process.env.SEED_ADMIN_NAME,
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    tableCount: Number(process.env.SEED_RESTAURANT_TABLES || 10),
  });

  console.log(`✅ Restaurant "${restaurant.name}" created at /r/${restaurant.slug}`);
  console.log(`   tables: ${seeded.tables}  dishes: ${seeded.dishes}  admin: ${seeded.admin || '(none)'}`);
  return restaurant;
}

const seed = async () => {
  if (process.env.SKIP_SEED === '1' || process.env.SKIP_SEED === 'true') {
    console.log('⏭️  [PostInstall] SKIP_SEED is set; skipping database seeding.');
    process.exit(0);
  }

  console.log('\n ====== npm postinstall / seed ====== \n');
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
    await seedPlatformAdmin();
    await seedFirstRestaurant();

    console.log('🎉 Seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    if (err.stack) console.error(err.stack);
    console.log(
      '\n--------------------------------------------\n [Seed Failed] fix the error, then run: npm run seed\n',
    );
    process.exit(1);
  }
};

seed();
