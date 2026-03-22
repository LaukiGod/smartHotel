// user.service.js — FIXED: removed mongoose transaction from setAllergies
// Transactions require a MongoDB replica set. For a standalone MongoDB instance,
// we do the two writes sequentially. The logic is identical, just no session/transaction.

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
    { tableNo, status: "free" },
    { status: "occupied" },
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
  });

  return {
    message: "Order placed",
    allergyAlert: allergyResult.alert,
    allergyMatches: allergyResult.matches,
    order,
  };
};

exports.clearTable = async (data) => {
  const { tableNo } = data;

  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) throw new Error("Table not found");

  if (table.currentUser) {
    await User.findByIdAndDelete(table.currentUser._id);
  }

  const cleared = await Table.findOneAndUpdate(
    { tableNo, status: "occupied" },
    { status: "free", currentUser: null, allergyAlert: false },
    { new: true }
  );

  if (!cleared) throw new Error("Table was already free");

  return { message: "Table cleared" };
};