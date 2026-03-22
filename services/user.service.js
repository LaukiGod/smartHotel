const User = require("../entities/user.entity");
const Table = require("../entities/table.entity");
const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const { checkAllergyRisk } = require("../utils/allergyChecker");
const { isTableValid } = require("../utils/helpers");
const mongoose = require("mongoose");

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

  // Claim the table first — fail fast if occupied
  const claimedTable = await Table.findOneAndUpdate(
    { tableNo, status: "free" },
    { status: "occupied" },
    { new: true }
  );

  if (!claimedTable) throw new Error("Table not available");

  // Only create user after table is secured — nothing to roll back on failure
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

  const currentTable = await Table.findOne({ tableNo });
  if (!currentTable) {
    throw new Error("Table not found");
  }

  if (!currentTable.currentUser) {
    throw new Error("No user logged in at this table");
  }

  const user = await User.findById(currentTable.currentUser);
  if (!user) {
    throw new Error("User not found");
  }

  user.allergies = allergies;
  await user.save();

  return { message: "Allergies updated", user };
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

  // Populate currentUser to access their allergies
  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) {
    throw new Error(`Table ${tableNo} not found`);
  }

  // Guard: table must be active before an order can be placed
  if (table.status !== "occupied") {
    throw new Error(`Table ${tableNo} is not active`);
  }

  // Fetch dishes — ingredients is [String], so no populate needed
  const dishDocs = await Dish.find({ _id: { $in: dishes } });
  if (dishDocs.length !== dishes.length) {
    throw new Error("One or more dishes not found");
  }

  // Collect all ingredient names
  const ingredientNames = dishDocs.flatMap(dish => dish.ingredients);

  // Get allergies from populated user — default to [] if none
  const allergiesInput = table.currentUser?.allergies || [];
  console.log("User allergies:", allergiesInput);

  // Check allergy risk — always run so allergyResult is always defined
  const allergyResult = checkAllergyRisk(allergiesInput, ingredientNames);

  if (allergyResult.alert) {
    console.warn("Allergy alert for table", tableNo, "matches:", allergyResult.matches);
  }

  // Create order
  const order = await Order.create({
    tableNo,
    dishes,
    allergiesInput,
    allergyAlert: allergyResult.alert
  });

  // Removed: redundant and unsafe Table status update
  // The table is already "occupied" from loginTable.
  // Re-writing it here could re-occupy a cleared table in a race condition.

  return {
    message: "Order placed",
    allergyAlert: allergyResult.alert,
    allergyMatches: allergyResult.matches,
    order
  };
};

exports.clearTable = async (data) => {
  const { tableNo } = data;

  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) throw new Error("Table not found");

  if (table.currentUser) {
    await User.findByIdAndDelete(table.currentUser._id);
  }

  // Atomic — replaces findOne + mutate + save
  const cleared = await Table.findOneAndUpdate(
    { tableNo, status: "occupied" },       // only clears if actually occupied
    { status: "free", currentUser: null, allergyAlert: false },
    { new: true }
  );

  if (!cleared) throw new Error("Table was already free");

  return { message: "Table cleared" };
};