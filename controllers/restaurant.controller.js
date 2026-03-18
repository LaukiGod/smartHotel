const restaurantService = require("../services/restaurant.service");

exports.getOrders = async (req, res) => {
  try {
    const result = await restaurantService.getOrders();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const result = await restaurantService.updateOrderStatus(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllergyAlerts = async (req, res) => {
  try {
    const result = await restaurantService.getAllergyAlerts();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addIngredient = async (req, res) => {
  try {
    const result = await restaurantService.addIngredient(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIngredients = async (req, res) => {
  try {
    const result = await restaurantService.getIngredients();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTables = async (req, res) => {
  try {
    const result = await restaurantService.getTables();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addDish = async (req, res) => {
  try {
    const { name, price, recipe, ingredients } = req.body;

    if (!name || !price || !recipe) {
      return res.status(400).json({ message: 'Name, price, and recipe are required' });
    }

    const newDish = await restaurantService.addDish({ name, price, recipe, ingredients });

    return res.status(201).json({
      message: 'Dish added successfully',
      dish: newDish
    });
  } catch (error) {
    console.error('Error adding dish:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};