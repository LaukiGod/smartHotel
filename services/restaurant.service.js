const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const Ingredient = require("../entities/inventory.entity");
const Table = require("../entities/table.entity");

exports.getOrders = async () => {
  const orders = await Order.find()
    .populate("dishes")
    .sort({ createdAt: -1 });

  return orders;
};

exports.updateOrderStatus = async (data) => {
  const { orderId, status } = data;

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true }
  );

  return { message: "Order status updated", order };
};

exports.getAllergyAlerts = async () => {
  const alerts = await Order.find({ allergyAlert: true })
    .populate("dishes")
    .sort({ createdAt: -1 });

  return alerts;
};

exports.addIngredient = async (data) => {
  const ingredient = await Ingredient.create(data);

  return {
    message: "Ingredient added to inventory",
    ingredient,
  };
};

exports.getIngredients = async () => {
  const ingredients = await Ingredient.find().sort({ createdAt: -1 });

  return ingredients;
};

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

  let dish = await Dish.findOne({ name });

  if (dish) {
    dish.price = price;
    dish.recipe = recipe;
    dish.ingredients = ingredients;
    await dish.save();
    return dish.dishId;
  }

  const lastDish = await Dish.findOne().sort({ dishId: -1 });
  const nextDishId = lastDish ? lastDish.dishId + 1 : 1;

  dish = new Dish({
    dishId: nextDishId,
    name,
    price,
    recipe,
    ingredients
  });

  await dish.save();
  return dish.dishId;
};