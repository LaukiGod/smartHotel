/**
 * Everything a brand-new restaurant needs to be usable the moment it is created:
 * its tables, a starter menu, and its first ADMIN.
 */
const path = require("path");

const Restaurant = require("../entities/restaurant.entity");
const Staff = require("../entities/staff.entity");
const { scoped } = require("./tenantScope");

const starterDishes = require(path.join(__dirname, "dishes.json"));

const DEFAULT_TABLE_COUNT = 10;

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Appends -2, -3, … until the slug is free. */
async function uniqueSlug(base) {
  const root = slugify(base) || "restaurant";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Restaurant.exists({ slug: candidate })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

async function seedTables(db, count) {
  const existing = await db.Table.countDocuments();
  if (existing > 0) return 0;

  const rows = [];
  for (let tableNo = 1; tableNo <= count; tableNo += 1) {
    rows.push({ tableNo, status: "available" });
  }
  await db.Table.insertMany(rows);
  return rows.length;
}

async function seedDishes(db) {
  const existing = await db.Dish.countDocuments();
  if (existing > 0) return 0;
  if (!Array.isArray(starterDishes) || !starterDishes.length) return 0;

  // dishId is a per-restaurant counter, so renumber rather than trusting the file.
  const rows = starterDishes.map((dish, i) => ({ ...dish, dishId: i + 1 }));
  await db.Dish.insertMany(rows);
  return rows.length;
}

async function seedOwnerAdmin(restaurant, { adminName, adminEmail }) {
  if (!adminEmail) return null;

  const email = String(adminEmail).toLowerCase().trim();
  const existing = await Staff.findOne({ restaurant: restaurant._id, email });
  if (existing) return existing;

  return Staff.create({
    restaurant: restaurant._id,
    name: adminName || email.split("@")[0],
    email,
    role: "ADMIN",
    googleId: null,
  });
}

/**
 * Creates a restaurant and everything under it. Returns the restaurant plus a
 * summary of what was seeded.
 */
async function provisionRestaurant({
  name,
  slug,
  adminName,
  adminEmail,
  tableCount = DEFAULT_TABLE_COUNT,
  contactEmail = "",
  phone = "",
  address = "",
  currency = "NPR",
  seedMenu = true,
}) {
  if (!name || !String(name).trim()) throw new Error("Restaurant name is required");

  const count = Number(tableCount);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new Error("tableCount must be a whole number between 1 and 500");
  }

  const finalSlug = slug ? slugify(slug) : await uniqueSlug(name);
  if (!finalSlug) throw new Error("Could not derive a valid slug from the name");
  if (await Restaurant.exists({ slug: finalSlug })) {
    throw new Error(`Slug "${finalSlug}" is already taken`);
  }

  const restaurant = await Restaurant.create({
    name: String(name).trim(),
    slug: finalSlug,
    contactEmail: contactEmail || adminEmail || "",
    phone,
    address,
    currency,
    status: "active",
  });

  const db = scoped(restaurant._id);

  let tablesSeeded = 0;
  let dishesSeeded = 0;
  let owner = null;

  try {
    tablesSeeded = await seedTables(db, count);
    if (seedMenu) dishesSeeded = await seedDishes(db);
    owner = await seedOwnerAdmin(restaurant, { adminName, adminEmail });
  } catch (err) {
    // No transactions on a standalone mongod, so unwind by hand rather than
    // leaving a half-built tenant behind.
    await db.Table.deleteMany({});
    await db.Dish.deleteMany({});
    await Staff.deleteMany({ restaurant: restaurant._id });
    await Restaurant.deleteOne({ _id: restaurant._id });
    throw err;
  }

  return {
    restaurant,
    seeded: {
      tables: tablesSeeded,
      dishes: dishesSeeded,
      admin: owner ? owner.email : null,
    },
  };
}

/** Removes a restaurant and every document that belongs to it. */
async function destroyRestaurant(restaurantId) {
  const db = scoped(restaurantId);
  const [orders, users, tables, dishes, inventory, staff] = await Promise.all([
    db.Order.deleteMany({}),
    db.User.deleteMany({}),
    db.Table.deleteMany({}),
    db.Dish.deleteMany({}),
    db.Inventory.deleteMany({}),
    Staff.deleteMany({ restaurant: restaurantId }),
  ]);
  await Restaurant.deleteOne({ _id: restaurantId });

  return {
    orders: orders.deletedCount || 0,
    users: users.deletedCount || 0,
    tables: tables.deletedCount || 0,
    dishes: dishes.deletedCount || 0,
    inventory: inventory.deletedCount || 0,
    staff: staff.deletedCount || 0,
  };
}

module.exports = {
  provisionRestaurant,
  destroyRestaurant,
  slugify,
  uniqueSlug,
  DEFAULT_TABLE_COUNT,
};
