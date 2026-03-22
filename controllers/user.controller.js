const userService = require("../services/user.service");

exports.loginTable = async (req, res) => {
  
  console.log("Login request received with body:", req.body);
  try {
    const result = await userService.loginTable(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.setAllergies = async (req, res) => {
  try {
    console.log("=================================Set allergies request received with body:", req.body);
    const result = await userService.setAllergies(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in setAllergies:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const result = await userService.getMenu();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.orderFood = async (req, res) => {
  try {
    const result = await userService.orderFood(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.clearTable = async (req, res) => {
  try {
    const result = await userService.clearTable(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};