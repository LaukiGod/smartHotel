const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const Inventory = require("../entities/inventory.entity");
const Table = require("../entities/table.entity");
const User = require("../entities/user.entity");
const { checkAllergyRisk } = require("../utils/allergyChecker");
const mongoose = require("mongoose");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ORDER_STATUSES = ["created", "paid", "preparing", "served", "completed"];
const isHttpUrl = (value) => {
  if (!value) return false;
  try {
    const u = new URL(String(value));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeAllergies = (raw) => {
  if (Array.isArray(raw)) {
    return raw
      .map((a) => String(a || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
};

const resolveDishIds = async (rawDishes) => {
  const dishList = Array.isArray(rawDishes) ? rawDishes : [];
  const normalizedTokens = dishList
    .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .filter(Boolean);

  if (!normalizedTokens.length) {
    throw new Error("dishes must be a non-empty array");
  }

  const uniqueTokens = Array.from(new Set(normalizedTokens));
  const objectIdCandidates = uniqueTokens
    .filter((token) => mongoose.Types.ObjectId.isValid(token))
    .map((token) => new mongoose.Types.ObjectId(token));
  const numericCandidates = uniqueTokens
    .map((token) => Number(token))
    .filter((n) => Number.isInteger(n) && n > 0);

  const or = [];
  if (objectIdCandidates.length) or.push({ _id: { $in: objectIdCandidates } });
  if (numericCandidates.length) or.push({ dishId: { $in: numericCandidates } });
  if (!or.length) throw new Error("One or more dishes not found");

  const dishDocs = await Dish.find({ $or: or });
  const lookup = new Map();
  for (const dish of dishDocs) {
    lookup.set(String(dish._id), dish);
    if (Number.isInteger(dish.dishId)) lookup.set(String(dish.dishId), dish);
  }

  const unresolved = uniqueTokens.filter((t) => !lookup.has(t));
  if (unresolved.length) throw new Error("One or more dishes not found");

  const resolvedDishIds = normalizedTokens.map((t) => lookup.get(t)._id);
  return { resolvedDishIds, dishDocs };
};

function lineItemsFromDishIds(resolvedDishIds) {
  return resolvedDishIds.map((dishId) => ({ dish: dishId, status: "queued" }));
}

exports.getOrders = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await Order.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  })
    .populate("dishes")
    .populate("lineItems.dish")
    .sort({ createdAt: -1 });
};

exports.updateOrderStatus = async (data) => {
  const { orderId, status } = data;

  if (!ORDER_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${ORDER_STATUSES.join(", ")}`);
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true, runValidators: true }
  );

  if (!order) throw new Error("Order not found");

  return { message: "Order status updated", order };
};

exports.createOrder = async (data) => {
  const tableNo = Number(data?.tableNo);
  const dishes = Array.isArray(data?.dishes) ? data.dishes : [];
  const customerName = String(data?.customerName || "Walk-in").trim() || "Walk-in";
  const phoneNo = data?.phoneNo == null ? "" : String(data.phoneNo).trim();
  const allergiesInput = normalizeAllergies(
    data?.allergiesInput ?? data?.allergies ?? data?.allergy
  );

  if (!Number.isFinite(tableNo) || tableNo <= 0) throw new Error("Valid tableNo is required");
  if (!Array.isArray(dishes) || dishes.length === 0) throw new Error("dishes must be a non-empty array");
  if (phoneNo && !/^\d{10}$/.test(phoneNo)) throw new Error("phoneNo must be exactly 10 digits");

  // Ensure table exists
  let table = await Table.findOne({ tableNo });
  if (!table) table = await Table.create({ tableNo });

  // Ensure there is a currentUser to attach allergies/session info
  let user = null;
  if (table.currentUser) {
    user = await User.findById(table.currentUser);
  }

  if (!user) {
    user = await User.create({ tableNo, name: customerName, phoneNo, allergies: allergiesInput, role: "user" });
    table.currentUser = user._id;
  } else if (allergiesInput.length) {
    user.allergies = allergiesInput;
    await user.save();
  }

  // Mark table active
  if (table.status === "available") {
    table.status = "occupied";
    table.occupiedSince = new Date();
  }
  table.lastStatusChangedAt = new Date();
  table.allergyAlert = (user.allergies || []).length > 0;
  await table.save();

  // Validate dishes and compute allergy flag
  const { resolvedDishIds, dishDocs } = await resolveDishIds(dishes);

  const ingredientNames = dishDocs.flatMap((d) => d.ingredients || []);
  const allergyResult = await checkAllergyRisk(user.allergies || [], ingredientNames);

  const order = await Order.create({
    tableNo,
    dishes: resolvedDishIds,
    lineItems: lineItemsFromDishIds(resolvedDishIds),
    allergiesInput: user.allergies || [],
    allergyAlert: allergyResult.alert,
    status: "created",
    paymentStatus: "pending",
    paymentMethod: "UPI"
  });

  // Propagate table allergy alert if needed
  if (order.allergyAlert) {
    await Table.findOneAndUpdate({ tableNo }, { allergyAlert: true }, { new: true });
  }

  const populated = await Order.findById(order._id).populate("dishes").populate("lineItems.dish");

  return {
    message: "Order created by staff",
    orderId: order._id,
    order: populated || order
  };
};

exports.updateOrderDetails = async (data) => {
  const { orderId } = data || {};
  if (!orderId) throw new Error("orderId is required");

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const nextDishes = Array.isArray(data?.dishes) ? data.dishes : null;
  const nextAllergies = normalizeAllergies(
    data?.allergiesInput ?? data?.allergies ?? data?.allergy
  );
  const hasAllergyField = ["allergiesInput", "allergies", "allergy"].some((k) =>
    Object.prototype.hasOwnProperty.call(data || {}, k)
  );

  if (nextDishes && nextDishes.length === 0) {
    throw new Error("dishes must be a non-empty array");
  }
  if (!nextDishes && !hasAllergyField) {
    throw new Error("Provide at least one field to update");
  }

  let dishDocs = null;
  if (nextDishes) {
    const resolved = await resolveDishIds(nextDishes);
    dishDocs = resolved.dishDocs;
    order.dishes = resolved.resolvedDishIds;
    order.lineItems = lineItemsFromDishIds(resolved.resolvedDishIds);
  } else {
    dishDocs = await Dish.find({ _id: { $in: order.dishes } });
  }

  if (hasAllergyField) {
    order.allergiesInput = nextAllergies;
  }

  const ingredientNames = dishDocs.flatMap((d) => d.ingredients || []);
  const allergyResult = await checkAllergyRisk(order.allergiesInput || [], ingredientNames);
  order.allergyAlert = allergyResult.alert;

  await order.save();

  await Table.findOneAndUpdate(
    { tableNo: order.tableNo },
    { allergyAlert: Boolean(order.allergyAlert) },
    { new: true }
  );

  const updatedOrder = await Order.findById(order._id).populate("dishes").populate("lineItems.dish");
  return {
    message: "Order details updated",
    order: updatedOrder || order
  };
};

const LINE_ITEM_STATUSES = ["queued", "preparing", "ready", "served"];

exports.updateLineItemStatus = async (data) => {
  const { orderId, lineIndex, status } = data || {};
  if (!orderId) throw new Error("orderId is required");
  if (lineIndex === undefined || lineIndex === null || Number(lineIndex) < 0) {
    throw new Error("lineIndex is required");
  }
  if (!LINE_ITEM_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${LINE_ITEM_STATUSES.join(", ")}`);
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  if (!order.lineItems?.length && order.dishes?.length) {
    const ids = order.dishes.map((d) => (d && d._id ? d._id : d));
    order.lineItems = lineItemsFromDishIds(ids);
  }

  const idx = Number(lineIndex);
  if (!order.lineItems?.length || idx >= order.lineItems.length) {
    throw new Error("Invalid line index");
  }

  order.lineItems[idx].status = status;
  order.markModified("lineItems");
  await order.save();

  const populated = await Order.findById(orderId).populate("dishes").populate("lineItems.dish");
  return { message: "Line item updated", order: populated };
};

exports.getAllergyAlerts = async () => {
  const orderAlerts = await Order.find({
    allergyAlert: true
  })
    .populate("dishes")
    .sort({ createdAt: -1 });

  const tableAlerts = await Table.find({ allergyAlert: true })
    .populate("currentUser")
    .sort({ tableNo: 1 });

  // Merge table-level alerts (active seat/session risk) with order alerts.
  // Avoid duplicate entries when an order alert already exists for the same table.
  const alertedTables = new Set(orderAlerts.map((o) => Number(o.tableNo)));
  const supplementalTableAlerts = tableAlerts
    .filter((t) => !alertedTables.has(Number(t.tableNo)))
    .map((t) => ({
      _id: `table-${t.tableNo}`,
      tableNo: t.tableNo,
      allergiesInput: Array.isArray(t.currentUser?.allergies) ? t.currentUser.allergies : [],
      allergyAlert: true,
      status: t.status || "occupied",
      createdAt: t.lastStatusChangedAt || new Date(),
      source: "table"
    }));

  const normalizedOrderAlerts = orderAlerts.map((o) => ({
    ...o.toObject(),
    source: "order"
  }));

  return [...normalizedOrderAlerts, ...supplementalTableAlerts];
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

exports.addDish = async ({ name, price, recipe, ingredients, imageUrl, category }) => {
  if (!name || !price) {
    throw new Error("Dish name and price are required");
  }

  if (!Array.isArray(ingredients)) {
    throw new Error("ingredients must be an array of strings");
  }

  // Image URL is optional; when provided must be http(s).
  if (imageUrl != null && String(imageUrl).trim()) {
    const trimmed = String(imageUrl).trim();
    if (!isHttpUrl(trimmed)) throw new Error("imageUrl must be a valid http(s) URL");
    imageUrl = trimmed;
  } else {
    imageUrl = "";
  }

  // Recipe is optional (Dish schema defaults to "").
  recipe = recipe == null ? "" : String(recipe);

  const existing = await Dish.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
  if (existing) {
    throw new Error(`A dish named "${existing.name}" already exists. Use the update endpoint to modify it.`);
  }

  const lastDish = await Dish.findOne().sort({ dishId: -1 });
  const nextDishId = lastDish ? lastDish.dishId + 1 : 1;

  const dish = new Dish({
    dishId: nextDishId,
    name: name.trim(),
    category: String(category || "General").trim() || "General",
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

exports.updateDish = async ({ dishId, name, price, recipe, ingredients, imageUrl, category }) => {
  if (!dishId) {
    throw new Error("dishId is required");
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (category !== undefined) {
    const nextCategory = String(category || "").trim();
    if (!nextCategory) throw new Error("category cannot be empty");
    updates.category = nextCategory;
  }
  if (price !== undefined) updates.price = price;
  if (recipe !== undefined) updates.recipe = recipe == null ? "" : String(recipe);
  if (imageUrl !== undefined) {
    const next = imageUrl == null ? "" : String(imageUrl).trim();
    if (next && !isHttpUrl(next)) throw new Error("imageUrl must be a valid http(s) URL");
    updates.imageUrl = next;
  }
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