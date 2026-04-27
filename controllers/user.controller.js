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

exports.getTableSession = async (req, res) => {
  try {
    const result = await userService.getTableSession(Number(req.params.tableNo));
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Browse-first entry: JSON or optional 302 to customer menu (query `redirect=1` + CUSTOMER_APP_ORIGIN). */
exports.selectTableQuickBrowse = async (req, res) => {
  try {
    const result = await userService.selectTableQuickBrowse(Number(req.params.tableNo));
    const base = process.env.CUSTOMER_APP_ORIGIN || process.env.FRONTEND_ORIGIN;
    if (req.query.redirect === "1" && base) {
      const url = `${String(base).replace(/\/$/, "")}${result.entryPath}`;
      return res.redirect(302, url);
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
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

exports.payOrder = async (req, res) => {
  try {
    const result = await userService.payOrder(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTableOrders = async (req, res) => {
  try {
    const result = await userService.getTableOrders(Number(req.params.tableNo));
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.callWaiter = async (req, res) => {
  try {
    const result = await userService.callWaiter(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.completeMeal = async (req, res) => {
  try {
    const result = await userService.completeMeal(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const result = await userService.submitReview(req.body);
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