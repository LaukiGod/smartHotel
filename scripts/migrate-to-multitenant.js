#!/usr/bin/env node
/**
 * One-time migration: single-restaurant database -> multi-tenant.
 *
 *   node scripts/migrate-to-multitenant.js --name "Bella Vista" [--slug bella-vista] [--dry-run]
 *
 * What it does, in order:
 *   1. Creates (or reuses) the restaurant that will own all existing data.
 *   2. Drops the old GLOBAL unique indexes. These are the reason a second
 *      restaurant cannot exist: tableNo_1, dishId_1, email_1 and googleId_1 were
 *      unique across the whole collection. Mongoose creates the new compound
 *      indexes on boot but never removes superseded ones.
 *   3. Backfills `restaurant` on every document that lacks it.
 *
 * Safe to run more than once: every step is a no-op once applied.
 */
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Restaurant = require("../entities/restaurant.entity");
const Staff = require("../entities/staff.entity");
const Order = require("../entities/order.entity");
const Table = require("../entities/table.entity");
const Dish = require("../entities/dish.entity");
const Inventory = require("../entities/inventory.entity");
const User = require("../entities/user.entity");
const { slugify, uniqueSlug } = require("../utils/tenantProvision");

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const DRY_RUN = has("dry-run");
const uri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;

/** Indexes that were unique across the whole collection before tenancy. */
const LEGACY_INDEXES = [
  [Table, "tableNo_1"],
  [Dish, "dishId_1"],
  [Staff, "email_1"],
  [Staff, "googleId_1"],
];

async function dropLegacyIndexes() {
  for (const [model, indexName] of LEGACY_INDEXES) {
    const collection = model.collection;
    let indexes;
    try {
      indexes = await collection.indexes();
    } catch {
      continue; // collection does not exist yet
    }

    if (!indexes.some((ix) => ix.name === indexName)) {
      console.log(`   · ${collection.collectionName}.${indexName} — already gone`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`   · ${collection.collectionName}.${indexName} — WOULD DROP`);
      continue;
    }

    await collection.dropIndex(indexName);
    console.log(`   ✅ dropped ${collection.collectionName}.${indexName}`);
  }
}

async function backfill(model, restaurantId) {
  const filter = { $or: [{ restaurant: { $exists: false } }, { restaurant: null }] };
  const count = await model.countDocuments(filter);
  const label = model.collection.collectionName;

  if (count === 0) {
    console.log(`   · ${label} — nothing to backfill`);
    return 0;
  }
  if (DRY_RUN) {
    console.log(`   · ${label} — WOULD backfill ${count} document(s)`);
    return count;
  }

  const res = await model.updateMany(filter, { $set: { restaurant: restaurantId } });
  console.log(`   ✅ ${label} — backfilled ${res.modifiedCount} document(s)`);
  return res.modifiedCount;
}

async function main() {
  if (!uri) {
    console.error("❌ Set MONGO_URI_LOCAL or MONGO_URI in .env");
    process.exit(1);
  }

  const name = flag("name");
  if (!name) {
    console.error('❌ --name is required, e.g. --name "Bella Vista"');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connected to ${mongoose.connection.name}${DRY_RUN ? "  (DRY RUN — no writes)" : ""}\n`);

  // ── 1. Target restaurant ────────────────────────────────────────────────────
  const requestedSlug = flag("slug") ? slugify(flag("slug")) : await uniqueSlug(name);
  let restaurant = await Restaurant.findOne({ slug: requestedSlug });

  if (restaurant) {
    console.log(`1. Restaurant — reusing existing "${restaurant.name}" (/r/${restaurant.slug})`);
  } else if (DRY_RUN) {
    console.log(`1. Restaurant — WOULD create "${name}" (/r/${requestedSlug})`);
    restaurant = { _id: new mongoose.Types.ObjectId(), slug: requestedSlug, name };
  } else {
    restaurant = await Restaurant.create({ name, slug: requestedSlug, status: "active" });
    console.log(`1. Restaurant — created "${restaurant.name}" (/r/${restaurant.slug})`);
  }

  // ── 2. Legacy indexes ───────────────────────────────────────────────────────
  console.log("\n2. Dropping legacy global unique indexes");
  await dropLegacyIndexes();

  // ── 3. Backfill ─────────────────────────────────────────────────────────────
  console.log("\n3. Backfilling the restaurant field");
  let total = 0;
  for (const model of [Table, Dish, Inventory, Order, User]) {
    total += await backfill(model, restaurant._id);
  }

  // Staff is special: pre-existing ADMIN/STAFF rows belong to this restaurant,
  // but a SUPER_ADMIN must keep restaurant: null.
  const staffFilter = {
    role: { $ne: "SUPER_ADMIN" },
    $or: [{ restaurant: { $exists: false } }, { restaurant: null }],
  };
  const staffCount = await Staff.countDocuments(staffFilter);
  if (staffCount === 0) {
    console.log("   · staffs — nothing to backfill");
  } else if (DRY_RUN) {
    console.log(`   · staffs — WOULD backfill ${staffCount} document(s)`);
    total += staffCount;
  } else {
    const res = await Staff.updateMany(staffFilter, { $set: { restaurant: restaurant._id } });
    console.log(`   ✅ staffs — backfilled ${res.modifiedCount} document(s)`);
    total += res.modifiedCount;
  }

  // ── 4. Rebuild indexes so the new compound ones exist ────────────────────────
  if (!DRY_RUN) {
    console.log("\n4. Building new compound indexes");
    for (const model of [Table, Dish, Inventory, Order, User, Staff]) {
      await model.syncIndexes();
      console.log(`   ✅ ${model.collection.collectionName}`);
    }
  }

  console.log(
    DRY_RUN
      ? `\n🔍 Dry run complete — ${total} document(s) would move to "${restaurant.name}".`
      : `\n🎉 Migration complete — ${total} document(s) now belong to "${restaurant.name}".`
  );
  if (!DRY_RUN) {
    console.log(`   Staff panel:  {FRONTEND_URL}/r/${restaurant.slug}/admin/dashboard`);
    console.log(`   Kiosk:        {FRONTEND_URL}/r/${restaurant.slug}`);
    console.log(`   Reprint the table QR codes — they now encode the /r/${restaurant.slug} prefix.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n❌ Migration failed:", err.message);
  if (err.stack) console.error(err.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
