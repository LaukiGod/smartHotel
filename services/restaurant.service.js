const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const Inventory = require("../entities/inventory.entity");
const Table = require("../entities/table.entity");

exports.getOrders = async () => {
  const orders = await Order.find()
    .populate("dishes")
    .sort({ createdAt: -1 });

  return orders;
};

exports.updateOrderStatus = async (data) => {
  const { orderId, status } = data;

  const validStatuses = ["pending", "preparing", "served"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true, runValidators: true }
  );

  if (!order) throw new Error("Order not found");

  return { message: "Order status updated", order };
};

exports.getAllergyAlerts = async () => {
  const alerts = await Order.find({ allergyAlert: true })
    .populate("dishes")
    .sort({ createdAt: -1 });

  return alerts;
};


// ============================== Inventory management Start =============================================
exports.addItemsToInventory = async (data) => {
  const items = Array.isArray(data) ? data : [data]; // accept single or bulk

  if (!items.length) {
    throw new Error("No items provided");
  }

  // Check for duplicate names in the incoming data itself
  const incomingNames = items.map(i => i.name?.trim().toLowerCase());
  const hasDuplicates = incomingNames.length !== new Set(incomingNames).size;
  if (hasDuplicates) {
    throw new Error("Duplicate item names in request");
  }

  // Check if any of these items already exist in DB
  const existing = await Inventory.find({
    name: { $in: incomingNames.map(n => new RegExp(`^${n}$`, "i")) }
  });

  if (existing.length) {
    const existingNames = existing.map(e => e.name).join(", ");
    throw new Error(`Items already exist in inventory: ${existingNames}`);
  }

  const created = await Inventory.insertMany(items);

  return {
    message: `${created.length} item(s) added to inventory`,
    items: created
  };
};

exports.getInventoryItems = async () => {
  const items = await Inventory.find().sort({ createdAt: -1 });

  if (!items.length) {
    return {
      message: "Inventory is empty",
      items: []
    };
  }

  const today = new Date();

  // Separate into categories for useful overview
  const expiringSoon = items.filter(item => {
    if (!item.expiryDate) return false;
    const daysLeft = (item.expiryDate - today) / (1000 * 60 * 60 * 24);
    return daysLeft <= 7 && daysLeft >= 0;
  });

  const expired = items.filter(item => {
    if (!item.expiryDate) return false;
    return item.expiryDate < today;
  });

  const lowStock = items.filter(item => item.quantity <= item.lowStockThreshold);

  return {
    message: "Inventory fetched successfully",
    total: items.length,
    alerts: {
      expiringSoon: expiringSoon.map(i => ({ name: i.name, expiryDate: i.expiryDate })),
      expired: expired.map(i => ({ name: i.name, expiryDate: i.expiryDate })),
      lowStock: lowStock.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit }))
    },
    items
  };
};

// ============================== Inventory management End ===============================================

exports.getTables = async () => {
  const tables = await Table.find().populate("currentUser");

  return tables;
};

exports.addDish = async ({ name, price, recipe, ingredients }) => {
  if (!name || !price) {
    throw new Error("Dish name and price are required");
  }

  if (!Array.isArray(ingredients)) {
    throw new Error("ingredients must be an array of strings");
  }

  const existing = await Dish.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });

  if (existing) {
    throw new Error(`A dish named "${existing.name}" already exists. Use the update endpoint to modify it.`);
  }

  const lastDish = await Dish.findOne().sort({ dishId: -1 });
  const nextDishId = lastDish ? lastDish.dishId + 1 : 1;

  const dish = new Dish({
    dishId: nextDishId,
    name: name.trim(),
    price,
    recipe,
    ingredients
  });

  await dish.save();
  return dish;
};

exports.updateDish = async ({ dishId, name, price, recipe, ingredients }) => {
  if (!dishId) {
    throw new Error("dishId is required");
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (price !== undefined) updates.price = price;
  if (recipe !== undefined) updates.recipe = recipe;
  if (ingredients !== undefined) {
    if (!Array.isArray(ingredients)) {
      throw new Error("ingredients must be an array of strings");
    }
    updates.ingredients = ingredients;
  }

  if (!Object.keys(updates).length) {
    throw new Error("No fields provided to update");
  }

  const dish = await Dish.findOneAndUpdate(
    { dishId },
    updates,
    { new: true, runValidators: true }
  );

  if (!dish) throw new Error(`Dish with id ${dishId} not found`);

  return dish;
};