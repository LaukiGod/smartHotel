const User = require("../entities/user.entity");
const Table = require("../entities/table.entity");
const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const { checkAllergyRisk } = require("../utils/allergyChecker");
const { isTableValid } = require("../utils/helpers");

exports.loginTable = async (data) => {
  const { tableNo, name, phoneNo } = data;

  if (tableNo === undefined || !isTableValid(tableNo)) {
    throw new Error("Invalid table number");
  }
  if (!name) throw new Error("Name is required");
  if (!phoneNo) throw new Error("Phone number is required");

  let table = await Table.findOne({ tableNo });
  if (!table) {
    table = await Table.create({ tableNo });
  }

  // Claim the table atomically — only succeeds if currently free
  const claimedTable = await Table.findOneAndUpdate(
    { tableNo, status: "available" },
    { status: "occupied", occupiedSince: new Date(), lastStatusChangedAt: new Date() },
    { new: true }
  );

  if (!claimedTable) throw new Error("Table not available");

  // Create user only after table is secured — nothing to roll back on failure
  const user = await User.create({ tableNo, name, phoneNo, role: "user" });

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
  const dishes = await Dish.find();
  return dishes;
};

exports.orderFood = async (data) => {
  const { tableNo, dishes } = data;

  if (!Array.isArray(dishes) || dishes.length === 0) {
    throw new Error("dishes must be a non-empty array");
  }

  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) throw new Error(`Table ${tableNo} not found`);

  if (table.status !== "occupied") {
    throw new Error(`Table ${tableNo} is not active`);
  }

  const dishDocs = await Dish.find({ _id: { $in: dishes } });
  if (dishDocs.length !== dishes.length) {
    throw new Error("One or more dishes not found");
  }

  const ingredientNames = dishDocs.flatMap((dish) => dish.ingredients);
  const allergiesInput = table.currentUser?.allergies || [];

  const allergyResult = await checkAllergyRisk(allergiesInput, ingredientNames);

  if (allergyResult.alert) {
    console.warn("Allergy alert for table", tableNo, "matches:", allergyResult.matches);
  }

  const order = await Order.create({
    tableNo,
    dishes,
    allergiesInput,
    allergyAlert: allergyResult.alert,
    status: "created",
    paymentStatus: "pending",
  });

  return {
    message: "Order placed",
    allergyAlert: allergyResult.alert,
    allergyMatches: allergyResult.matches,
    order,
  };
};

exports.payOrder = async (data) => {
  const { orderId, upiReference } = data;
  if (!orderId) throw new Error("orderId is required");
  if (!upiReference) throw new Error("upiReference is required");

  const order = await Order.findByIdAndUpdate(
    orderId,
    { paymentStatus: "paid", status: "paid", upiReference },
    { new: true }
  );
  if (!order) throw new Error("Order not found");

  return { message: "Payment recorded", order };
};

exports.getTableOrders = async (tableNo) => {
  if (!isTableValid(tableNo)) throw new Error("Invalid table number");
  const orders = await Order.find({ tableNo }).populate("dishes").sort({ createdAt: -1 });
  return orders;
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