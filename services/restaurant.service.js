const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const Inventory = require("../entities/inventory.entity");
const Table = require("../entities/table.entity");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.getOrders = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await Order.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  }).populate("dishes").sort({ createdAt: -1 });
};

exports.updateOrderStatus = async (data) => {
  const { orderId, status } = data;

  const validStatuses = ["created", "paid", "preparing", "served", "completed"];
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
  const alerts = await Order.find({
    allergyAlert: true,
    status: { $nin: ["completed"] }
  })
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

exports.getNotifications = async () => {
  const [newOrders, mealCompleted, waiterRequests] = await Promise.all([
    Order.countDocuments({ status: "created" }),
    Order.countDocuments({ status: "completed" }),
    Table.countDocuments({ waiterRequested: true })
  ]);

  return {
    newOrders,
    mealCompleted,
    waiterRequests
  };
};

exports.markTableAvailable = async (tableNo) => {
  const table = await Table.findOneAndUpdate(
    { tableNo },
    {
      status: "available",
      waiterRequested: false,
      allergyAlert: false,
      currentUser: null,
      occupiedSince: null,
      lastStatusChangedAt: new Date()
    },
    { new: true }
  );
  if (!table) throw new Error("Table not found");
  return { message: "Table marked available", table };
};

exports.getManagerMetrics = async () => {
  const [orders, tables] = await Promise.all([
    Order.find().populate("dishes"),
    Table.find()
  ]);

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const revenue = paidOrders.reduce(
    (sum, order) => sum + (order.dishes || []).reduce((s, d) => s + (Number(d.price) || 0), 0),
    0
  );
  const customersServed = new Set(orders.map((o) => `${o.tableNo}-${new Date(o.createdAt).toDateString()}`)).size;

  const usage = {
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    cleaning: tables.filter((t) => t.status === "cleaning").length
  };

  const peakHoursMap = new Map();
  orders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    peakHoursMap.set(hour, (peakHoursMap.get(hour) || 0) + 1);
  });
  const peakHours = Array.from(peakHoursMap.entries())
    .map(([hour, ordersCount]) => ({ hour, orders: ordersCount }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  return {
    customersServed,
    revenue,
    tableUsage: usage,
    peakHours,
    totalOrders: orders.length
  };
};

exports.addDish = async ({ name, price, recipe, ingredients, imageUrl }) => {
  if (!name || !price) {
    throw new Error("Dish name and price are required");
  }

  if (!Array.isArray(ingredients)) {
    throw new Error("ingredients must be an array of strings");
  }

  // Use env-configured fallback image instead of hardcoded URL
  if (!imageUrl || typeof imageUrl !== "string") {
    imageUrl = process.env.DEFAULT_DISH_IMAGE_URL;
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
    ingredients,
    imageUrl
  });

  await dish.save();
  return dish;
};

exports.deleteDish = async (id) => {
  const dish = await Dish.findByIdAndDelete(id);
  if (!dish) throw new Error("Dish not found");
  return { message: `Dish "${dish.name}" deleted successfully` };
};

exports.deleteInventoryItem = async (id) => {
  const item = await Inventory.findByIdAndDelete(id);
  if (!item) throw new Error("Inventory item not found");
  return { message: `"${item.name}" removed from inventory` };
};

exports.updateInventoryItem = async (id, data) => {
  if (!id) {
    throw new Error("Inventory item ID is required");
  }

  const item = await Inventory.findById(id);
  if (!item) throw new Error("Inventory item not found");

  const updates = {};
  if (data.name !== undefined) {
    const nextName = String(data.name || "").trim();
    if (!nextName) throw new Error("Name cannot be empty");

    const existingWithName = await Inventory.findOne({
      _id: { $ne: id },
      name: new RegExp(`^${escapeRegex(nextName)}$`, "i")
    });
    if (existingWithName) {
      throw new Error(`Inventory item "${nextName}" already exists`);
    }

    updates.name = nextName;
  }
  if (data.quantity !== undefined) {
    if (data.quantity < 0) throw new Error("Quantity cannot be negative");
    updates.quantity = data.quantity;
  }
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.category !== undefined) updates.category = data.category;
  if (data.lowStockThreshold !== undefined) updates.lowStockThreshold = data.lowStockThreshold;
  if (data.expiryDate !== undefined) updates.expiryDate = data.expiryDate;

  if (!Object.keys(updates).length) {
    throw new Error("No fields provided to update");
  }

  Object.assign(item, updates);
  await item.save();

  return { message: "Inventory item updated successfully", item };
};

exports.updateDish = async ({ dishId, name, price, recipe, ingredients, imageUrl }) => {
  if (!dishId) {
    throw new Error("dishId is required");
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (price !== undefined) updates.price = price;
  if (recipe !== undefined) updates.recipe = recipe;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
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