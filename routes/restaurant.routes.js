const express = require("express");
const router = express.Router();

const restaurantController = require("../controllers/restaurant.controller");
const { validateSecret } = require("../middlewares/auth.middlewhare");

// get all orders
router.get("/orders", validateSecret, restaurantController.getOrders);

// update order status
router.post("/order-status", validateSecret, restaurantController.updateOrderStatus);

// get allergy alerts
router.get("/alerts", validateSecret, restaurantController.getAllergyAlerts);

// ingredient inventory
router.post("/add-inventory", validateSecret, restaurantController.addItemsToInventory);
router.get("/inventory", validateSecret, restaurantController.getInventoryItems);

// table status
router.get("/tables", restaurantController.getTables);

// add/update/delete dish
router.post("/add-dish", validateSecret, restaurantController.addDish);
router.put("/update-dish", validateSecret, restaurantController.updateDish);
router.delete("/dish/:id", validateSecret, restaurantController.deleteDish);

// delete inventory item
router.delete("/inventory/:id", validateSecret, restaurantController.deleteInventoryItem);

module.exports = router;