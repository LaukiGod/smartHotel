const User = require("../entities/user.entity");
const Table = require("../entities/table.entity");
const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const { checkAllergyRisk } = require("../utils/allergyChecker");
const { isTableValid } = require("../utils/helpers");
const { generateTableToken } = require("../utils/tableToken");
const mongoose = require("mongoose");

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

exports.loginTable = async (data) => {
  const { tableNo, name, phoneNo, allowExistingSession } = data;

  if (tableNo === undefined || !isTableValid(tableNo)) {
    throw new Error("Invalid table number");
  }
  if (!name) throw new Error("Name is required");
  const phone = phoneNo == null ? "" : String(phoneNo).trim();
  if (phone && !/^\d{10}$/.test(phone)) {
    throw new Error("Phone number must be exactly 10 digits");
  }

  let table = await Table.findOne({ tableNo });
  if (!table) {
    table = await Table.create({ tableNo, token: generateTableToken() });
  }

  // Claim the table atomically — only succeeds if currently free
  const claimedTable = await Table.findOneAndUpdate(
    { tableNo, status: "available" },
    { status: "occupied", occupiedSince: new Date(), lastStatusChangedAt: new Date() },
    { new: true }
  );

  if (!claimedTable) {
    // Edit-details flow: allow updating current session details on the same occupied table
    // instead of trying to claim the table again.
    if (allowExistingSession) {
      const occupiedTable = await Table.findOne({ tableNo }).populate("currentUser");
      if (!occupiedTable) throw new Error("Table not found");
      if (occupiedTable.status !== "occupied" || !occupiedTable.currentUser) {
        throw new Error("Table not available");
      }

      occupiedTable.currentUser.name = name;
      if (phone) occupiedTable.currentUser.phoneNo = phone;
      await occupiedTable.currentUser.save();

      return { message: "Table session updated", user: occupiedTable.currentUser };
    }

    throw new Error("Table not available");
  }

  // Create user only after table is secured — nothing to roll back on failure
  const user = await User.create({ tableNo, name, phoneNo: phone, role: "user" });

  // Attach user to table
  claimedTable.currentUser = user._id;
  await claimedTable.save();

  return { message: "Table session started", user };
};

exports.setAllergies = async (data) => {
  const { tableNo, allergies } = data;

  if (!tableNo) throw new Error("tableNo is required");
  if (!Array.isArray(allergies)) throw new Error("allergies must be an array");

  // Find the table and get its currentUser
  const currentTable = await Table.findOneAndUpdate(
    { tableNo },
    { allergyAlert: allergies.length > 0 },
    { new: true, projection: { currentUser: 1 } }
  );

  if (!currentTable) throw new Error("Table not found");
  if (!currentTable.currentUser) throw new Error("No user assigned to this table");

  // Update the user's allergies
  const updatedUser = await User.findByIdAndUpdate(
    currentTable.currentUser,
    { allergies },
    { new: true }
  );

  if (!updatedUser) throw new Error("User not found");

  return {
    message: "Allergies updated successfully",
    user: updatedUser,
  };
};

exports.getMenu = async () => {
  const dishes = await Dish.find().sort({ category: 1, name: 1 });
  return dishes;
};

exports.orderFood = async (data) => {
  const { tableNo, dishes } = data;

  const { resolvedDishIds, dishDocs } = await resolveDishIds(dishes);

  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) throw new Error(`Table ${tableNo} not found`);

  if (table.status !== "occupied") {
    throw new Error(`Table ${tableNo} is not active`);
  }

  const ingredientNames = dishDocs.flatMap((dish) => dish.ingredients || []);
  const allergiesInput = table.currentUser?.allergies || [];

  const allergyResult = await checkAllergyRisk(allergiesInput, ingredientNames);

  if (allergyResult.alert) {
    console.warn("Allergy alert for table", tableNo, "matches:", allergyResult.matches);
  }

  // Re-use the latest open ticket for this table so "edit details → menu → checkout again"
  // updates the same admin order instead of creating a duplicate (until meal is served/completed).
  const OPEN_ORDER_STATUSES = ["created", "confirmed", "preparing"];
  const existing = await Order.findOne({
    tableNo,
    status: { $in: OPEN_ORDER_STATUSES },
  }).sort({ createdAt: -1 });

  let order;
  let updatedExisting = false;
  if (existing) {
    order = existing;
    // Append to the same open order (do not replace).
    const prevDishes = Array.isArray(order.dishes) ? order.dishes : [];
    const nextDishes = prevDishes.concat(resolvedDishIds);
    order.dishes = nextDishes;

    const prevLines = Array.isArray(order.lineItems) ? order.lineItems : [];
    order.lineItems = prevLines.concat(lineItemsFromDishIds(resolvedDishIds));

    // Recompute allergy risk for the full (combined) order.
    const uniqueDishIds = Array.from(new Set(nextDishes.map((d) => String(d)))).map((id) => new mongoose.Types.ObjectId(id));
    const fullDishDocs = await Dish.find({ _id: { $in: uniqueDishIds } });
    const fullIngredientNames = fullDishDocs.flatMap((dish) => dish.ingredients || []);
    const fullAllergyResult = await checkAllergyRisk(allergiesInput, fullIngredientNames);

    order.allergiesInput = allergiesInput;
    order.allergyAlert = fullAllergyResult.alert;
    await order.save();
    updatedExisting = true;
  } else {
    order = await Order.create({
      tableNo,
      dishes: resolvedDishIds,
      lineItems: lineItemsFromDishIds(resolvedDishIds),
      allergiesInput,
      allergyAlert: allergyResult.alert,
      status: "confirmed",
    });
  }

  // Only ever raise the table's flag here, never clear it — the customer's declared
  // allergies (set via setAllergies) must stay flagged even if THIS particular order's
  // dishes happen not to match an ingredient keyword. The flag is cleared when the
  // session actually ends (clearTable / markTableAvailable / completeMeal).
  if (order.allergyAlert) {
    await Table.findOneAndUpdate(
      { tableNo },
      { allergyAlert: true },
      { new: true }
    );
  }

  const populated = await Order.findById(order._id).populate("dishes").populate("lineItems.dish");

  return {
    message: updatedExisting ? "Items added to existing order" : "Order placed",
    allergyAlert: updatedExisting ? Boolean(order.allergyAlert) : allergyResult.alert,
    allergyMatches: allergyResult.matches,
    order: populated || order,
    orderId: order._id,
  };
};

exports.confirmOrder = async (data) => {
  const { orderId } = data;
  if (!orderId) throw new Error("orderId is required");

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status: "confirmed" },
    { new: true }
  );
  if (!order) throw new Error("Order not found");

  return { message: "Order confirmed", order };
};

exports.getTableOrders = async (tableNo) => {
  if (!isTableValid(tableNo)) throw new Error("Invalid table number");
  const table = await Table.findOne({ tableNo }).select({ occupiedSince: 1 });
  const query = { tableNo };
  // Restrict history to current seating session so old/completed sessions are not shown in tracking.
  if (table?.occupiedSince) {
    query.createdAt = { $gte: table.occupiedSince };
  }
  const orders = await Order.find(query)
    .populate("dishes")
    .populate("lineItems.dish")
    .sort({ createdAt: -1 });
  return orders;
};

/**
 * Resolve the public identifier from a QR/kiosk link to a real tableNo.
 * Accepts either the legacy plain table number (kiosk staff device, which already
 * lists real tableNo values) or the opaque customer-facing token (printed QR codes).
 */
const resolveTableNo = async (identifier) => {
  const asNumber = Number(identifier);
  if (Number.isInteger(asNumber) && asNumber > 0) return asNumber;

  const table = await Table.findOne({ token: String(identifier) }).select({ tableNo: 1 });
  if (!table) throw new Error("Invalid table link");
  return table.tableNo;
};

/**
 * GET table-select (quick entry): claim table immediately and start a lightweight user session.
 * Useful for QR-based direct booking where scanning should reserve/occupy the table in staff panel.
 */
exports.selectTableQuickBrowse = async (identifier) => {
  const n = await resolveTableNo(identifier);
  if (!isTableValid(n)) throw new Error("Invalid table number");
  let table = await Table.findOne({ tableNo: n }).populate("currentUser");
  if (!table) table = await Table.create({ tableNo: n, token: generateTableToken() });

  // Idempotent behavior: if already occupied with a seated user, keep that active session.
  if (table.status === "occupied" && table.currentUser) {
    return {
      tableNo: n,
      flow: "quick",
      user: {
        _id: String(table.currentUser._id),
        name: table.currentUser.name || "Guest",
        tableNo: n
      },
      entryPath: `/customer/menu?tableId=${n}&flow=quick`,
    };
  }

  // Claim table atomically.
  // Accept legacy rows where status might be missing/null/empty, and rows marked occupied but without currentUser.
  const claimed = await Table.findOneAndUpdate(
    {
      tableNo: n,
      $or: [
        { status: "available" },
        { status: null },
        { status: "" },
        { status: { $exists: false } },
        { status: "occupied", currentUser: null }
      ]
    },
    { status: "occupied", occupiedSince: new Date(), lastStatusChangedAt: new Date() },
    { new: true }
  );
  if (!claimed) throw new Error("Table not available");

  // Create a minimal user session so staff panel can see the occupied table with currentUser.
  const quickUser = await User.create({
    tableNo: n,
    name: "Quick Guest",
    phoneNo: "",
    role: "user"
  });

  claimed.currentUser = quickUser._id;
  await claimed.save();

  return {
    tableNo: n,
    flow: "quick",
    user: {
      _id: String(quickUser._id),
      name: quickUser.name,
      tableNo: n
    },
    entryPath: `/customer/menu?tableId=${n}&flow=quick`,
  };
};

/** Public read for customer SPA: occupied table + seated user identity (matches session after login). */
exports.getTableSession = async (tableNo) => {
  const n = Number(tableNo);
  if (!isTableValid(n)) throw new Error("Invalid table number");
  const table = await Table.findOne({ tableNo: n }).populate("currentUser");
  if (!table) {
    return { valid: false, reason: "not_found" };
  }
  if (table.status !== "occupied" || !table.currentUser) {
    return { valid: false, reason: "not_occupied" };
  }
  const u = table.currentUser;
  return {
    valid: true,
    userId: String(u._id),
    name: u.name,
    phoneNo: u.phoneNo,
    tableNo: n,
  };
};

exports.callWaiter = async (data) => {
  const { tableNo } = data;
  if (!isTableValid(tableNo)) throw new Error("Invalid table number");
  const table = await Table.findOneAndUpdate(
    { tableNo, status: { $in: ["occupied", "cleaning"] } },
    { waiterRequested: true },
    { new: true }
  );
  if (!table) throw new Error("Table not active");
  return { message: "Waiter has been notified", tableNo };
};

exports.completeMeal = async (data) => {
  const { tableNo } = data;
  if (!isTableValid(tableNo)) throw new Error("Invalid table number");

  const completedOrders = await Order.updateMany(
    { tableNo, status: { $ne: "completed" } },
    { status: "completed" }
  );

  await Table.findOneAndUpdate(
    { tableNo, status: "occupied" },
    { status: "cleaning", lastStatusChangedAt: new Date(), waiterRequested: false, allergyAlert: false },
    { new: true }
  );

  return {
    message: "Meal marked completed. Table sent for cleaning.",
    completedOrders: completedOrders.modifiedCount || 0
  };
};

exports.submitReview = async (data) => {
  const { orderId, rating, comment } = data;
  if (!orderId) throw new Error("orderId is required");
  if (!rating || Number(rating) < 1 || Number(rating) > 5) throw new Error("rating must be between 1 and 5");

  const order = await Order.findByIdAndUpdate(
    orderId,
    { review: { rating: Number(rating), comment: comment || "" } },
    { new: true }
  );
  if (!order) throw new Error("Order not found");
  return { message: "Thanks for your feedback", orderId: order._id };
};

exports.clearTable = async (data) => {
  const { tableNo } = data;

  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) throw new Error("Table not found");

  if (table.currentUser) {
    await User.findByIdAndDelete(table.currentUser._id);
  }

  const cleared = await Table.findOneAndUpdate(
    { tableNo, status: { $in: ["occupied", "cleaning"] } },
    {
      status: "available",
      currentUser: null,
      allergyAlert: false,
      waiterRequested: false,
      occupiedSince: null,
      lastStatusChangedAt: new Date()
    },
    { new: true }
  );

  if (!cleared) throw new Error("Table already available");

  return { message: "Table cleared" };
};