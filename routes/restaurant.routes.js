const express = require("express");
const router = express.Router();

const restaurantController = require("../controllers/restaurant.controller");

// get all orders
router.get("/orders", restaurantController.getOrders);

// update order status
router.post("/order-status", restaurantController.updateOrderStatus);

// get allergy alerts
router.get("/alerts", restaurantController.getAllergyAlerts);

// ingredient inventory
router.post("/add-inventory", restaurantController.addItemsToInventory);
router.get("/inventory", restaurantController.getInventoryItems);

// table status
router.get("/tables", restaurantController.getTables);

// add/update dish
router.post("/add-dish", restaurantController.addDish);

router.put("/update-dish", restaurantController.updateDish);

module.exports = router;