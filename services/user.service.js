const User = require("../entities/user.entity");
const Table = require("../entities/table.entity");
const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const { checkAllergyRisk } = require("../utils/allergyChecker");
const { isTableValid } = require("../utils/helpers");

exports.loginTable = async (data) => {
  const { tableNo, name, phoneNo } = data;

  if (tableNo === undefined || isTableValid(tableNo) === false) {
    throw new Error("Invalid table number");
  }

  if (!name) {
    throw new Error("Name is required");
  }

  if (!phoneNo) {
    throw new Error("Phone number is required");
  }

  let table = await Table.findOne({ tableNo });

  if (!table) {
    table = await Table.create({ tableNo });
  }

  if (table.status === "occupied") {
    throw new Error("Table already occupied");
  }

  const user = await User.create({
    tableNo,
    name,
    phoneNo,
    role: "user",
  });

  table.status = "occupied";
  table.currentUser = user._id;
  await table.save();

  return { message: "Table session started", user };
};

exports.setAllergies = async (data) => {
  const { tableNo, allergies } = data;

  let currentTable = await Table.findOne({ tableNo });
  if (!currentTable) {
    throw new Error("Table not found");
  }

  const user = await User.findByIdAndUpdate(
    currentTable.currentUser,
    { allergies },
    { new: true }
  );

  return { message: "Allergies updated", user };
};

exports.getMenu = async () => {
  const dishes = await Dish.find();

  return dishes;
};

exports.orderFood = async (data) => {
  const { tableNo, dishes, allergiesInput } = data;

  let ingredientNames = [];

  // fetch dishes and ingredients
  const dishDocs = await Dish.find({ _id: { $in: dishes } })
    .populate("ingredients");

  dishDocs.forEach(dish => {
    dish.ingredients.forEach(ing => {
      ingredientNames.push(ing.name);
    });
  });

  // check allergy risk
  const allergyResult = checkAllergyRisk(allergiesInput, ingredientNames);

  const order = await Order.create({
    tableNo,
    dishes,
    allergiesInput,
    allergyAlert: allergyResult.alert
  });

  return {
    message: "Order placed",
    allergyAlert: allergyResult.alert,
    matchedIngredient: allergyResult.ingredient || null,
    order
  };
};

exports.clearTable = async (data) => {
  const { tableNo } = data;

  const table = await Table.findOne({ tableNo });

  if (!table) throw new Error("Table not found");

  table.status = "free";
  table.currentUser = null;

  await table.save();

  return { message: "Table cleared" };
};