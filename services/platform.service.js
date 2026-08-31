const Restaurant = require("../entities/restaurant.entity");
const Staff = require("../entities/staff.entity");
const Order = require("../entities/order.entity");
const Table = require("../entities/table.entity");
const Dish = require("../entities/dish.entity");
const { provisionRestaurant, destroyRestaurant } = require("../utils/tenantProvision");
const { invalidateTenant } = require("../middlewares/tenant.middleware");

/** One aggregation per collection beats N+1 counts once there are many tenants. */
async function countsByRestaurant(model, match = {}) {
  const rows = await model.aggregate([
    { $match: match },
    { $group: { _id: "$restaurant", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

exports.listRestaurants = async () => {
  const restaurants = await Restaurant.find().sort({ createdAt: -1 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [staffCounts, tableCounts, dishCounts, ordersToday] = await Promise.all([
    countsByRestaurant(Staff),
    countsByRestaurant(Table),
    countsByRestaurant(Dish),
    countsByRestaurant(Order, { createdAt: { $gte: startOfDay } }),
  ]);

  return restaurants.map((r) => {
    const key = String(r._id);
    return {
      _id: r._id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      contactEmail: r.contactEmail,
      phone: r.phone,
      address: r.address,
      currency: r.currency,
      createdAt: r.createdAt,
      counts: {
        staff: staffCounts.get(key) || 0,
        tables: tableCounts.get(key) || 0,
        dishes: dishCounts.get(key) || 0,
        ordersToday: ordersToday.get(key) || 0,
      },
    };
  });
};

exports.getRestaurant = async (id) => {
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) throw new Error("Restaurant not found");

  const staff = await Staff.find({ restaurant: restaurant._id })
    .select("-googleId")
    .sort({ createdAt: -1 });

  return { restaurant, staff };
};

exports.createRestaurant = async (payload) => {
  const { restaurant, seeded } = await provisionRestaurant(payload);
  invalidateTenant(restaurant.slug);
  return {
    message: `Restaurant "${restaurant.name}" created`,
    restaurant,
    seeded,
  };
};

exports.updateRestaurant = async (id, data) => {
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) throw new Error("Restaurant not found");

  const updatable = ["name", "contactEmail", "phone", "address", "currency", "logoUrl"];
  let changed = false;
  for (const key of updatable) {
    if (data[key] !== undefined) {
      restaurant[key] = data[key];
      changed = true;
    }
  }
  if (!changed) throw new Error("No fields provided to update");

  await restaurant.save();
  invalidateTenant(restaurant.slug);
  return { message: "Restaurant updated", restaurant };
};

exports.setRestaurantStatus = async (id, status) => {
  if (!["active", "suspended"].includes(status)) {
    throw new Error('status must be "active" or "suspended"');
  }
  const restaurant = await Restaurant.findByIdAndUpdate(id, { status }, { new: true });
  if (!restaurant) throw new Error("Restaurant not found");

  invalidateTenant(restaurant.slug);
  return {
    message: `Restaurant "${restaurant.name}" ${status === "active" ? "activated" : "suspended"}`,
    restaurant,
  };
};

exports.deleteRestaurant = async (id, confirmSlug) => {
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) throw new Error("Restaurant not found");

  // Deleting a tenant destroys every order, table, dish and staff row under it,
  // so require the caller to type the slug back.
  if (String(confirmSlug) !== restaurant.slug) {
    throw new Error(`Confirmation failed — send confirmSlug: "${restaurant.slug}" to delete this restaurant`);
  }

  const removed = await destroyRestaurant(restaurant._id);
  invalidateTenant(restaurant.slug);
  return { message: `Restaurant "${restaurant.name}" and all its data were deleted`, removed };
};

exports.platformStats = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [restaurants, active, suspended, staff, ordersToday] = await Promise.all([
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ status: "active" }),
    Restaurant.countDocuments({ status: "suspended" }),
    Staff.countDocuments({ role: { $ne: "SUPER_ADMIN" } }),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
  ]);

  return { restaurants, active, suspended, staff, ordersToday };
};

/** SUPER_ADMIN can add another platform administrator. */
exports.addSuperAdmin = async ({ name, email }) => {
  if (!name || !email) throw new Error("name and email are required");
  const normalized = String(email).toLowerCase().trim();

  const exists = await Staff.findOne({ restaurant: null, email: normalized });
  if (exists) throw new Error("That email is already a platform administrator");

  const staff = await Staff.create({ name, email: normalized, role: "SUPER_ADMIN", restaurant: null });
  return { message: "Platform administrator added", id: staff._id, email: staff.email };
};

exports.listSuperAdmins = () =>
  Staff.find({ role: "SUPER_ADMIN" }).select("-googleId").sort({ createdAt: -1 });
