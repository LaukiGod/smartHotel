const restaurantService = require("../services/restaurant.service");
const { generateTableQRCode } = require("../services/qr.service");

/**
 * `req.db` is the tenant-scoped model bundle installed by `resolveTenant`.
 * Passing it into every service call is what keeps one restaurant's staff from
 * ever reading or writing another's rows.
 */

exports.getOrders = async (req, res) => {
  try {
    const result = await restaurantService.getOrders(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const result = await restaurantService.updateOrderStatus(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateLineItemStatus = async (req, res) => {
  try {
    const result = await restaurantService.updateLineItemStatus(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const result = await restaurantService.createOrder(req.db, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateOrderDetails = async (req, res) => {
  try {
    const result = await restaurantService.updateOrderDetails(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllergyAlerts = async (req, res) => {
  try {
    const result = await restaurantService.getAllergyAlerts(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addItemsToInventory = async (req, res) => {
  try {
    const result = await restaurantService.addItemsToInventory(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInventoryItems = async (req, res) => {
  try {
    const result = await restaurantService.getInventoryItems(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTables = async (req, res) => {
  try {
    const result = await restaurantService.getTables(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTableCount = async (req, res) => {
  try {
    const result = await restaurantService.getTableCount(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.increaseTableCount = async (req, res) => {
  try {
    const result = await restaurantService.increaseTableCount(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteTableById = async (req, res) => {
  try {
    const result = await restaurantService.deleteTableById(req.db, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.addDish = async (req, res) => {
  try {
    const { name, price, recipe, ingredients, imageUrl, category, isAvailable } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    const newDish = await restaurantService.addDish(req.db, { name, price, recipe, ingredients, imageUrl, category, isAvailable });

    return res.status(201).json({
      message: 'Dish added successfully',
      dish: newDish
    });
  } catch (error) {
    console.error('Error adding dish:', error);
    return res.status(400).json({ message: error.message });
  }
};

exports.getAllDishes = async (req, res) => {
  try {
    const dishes = await restaurantService.getAllDishes(req.db);
    res.status(200).json(dishes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDish = async (req, res) => {
  try {
    const { dishId, name, price, recipe, ingredients, imageUrl, category, isAvailable } = req.body;
    const newDish = await restaurantService.updateDish(req.db, { dishId, name, price, recipe, ingredients, imageUrl, category, isAvailable });

    return res.status(200).json({
      message: 'Dish updated successfully',
      dish: newDish
    });
  } catch (error) {
    console.error('Error updating dish:', error);
    return res.status(400).json({ message: error.message });
  }
};

exports.deleteDish = async (req, res) => {
  try {
    const result = await restaurantService.deleteDish(req.db, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const result = await restaurantService.updateInventoryItem(req.db, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteInventoryItem = async (req, res) => {
  try {
    const result = await restaurantService.deleteInventoryItem(req.db, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const result = await restaurantService.getNotifications(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markTableAvailable = async (req, res) => {
  try {
    const result = await restaurantService.markTableAvailable(req.db, Number(req.params.tableNo));
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getManagerMetrics = async (req, res) => {
  try {
    const result = await restaurantService.getManagerMetrics(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate QR code for table — encodes this restaurant's slug so the scan lands
// on the right tenant's customer app.
exports.generateTableQRCode = async (req, res) => {
  try {
    const tableNo = Number(req.params.tableNo);
    const qrCodeData = await generateTableQRCode(req.restaurant, tableNo);
    res.set("Content-Type", "image/png");
    res.set("Content-Disposition", `attachment; filename=${req.restaurant.slug}-table-${tableNo}-qr.png`);
    res.status(200).send(qrCodeData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
