const express = require("express");
const router = express.Router();

const restaurantController = require("../controllers/restaurant.controller");
const { authenticate, authorize } = require("../middlewares/staffAuth.middleware");

// orders — ADMIN + STAFF
router.get("/orders",       authenticate, authorize("ADMIN", "STAFF"), restaurantController.getOrders);
router.post("/order-status",authenticate, authorize("ADMIN", "STAFF"), restaurantController.updateOrderStatus);
router.post("/create-order",authenticate, authorize("ADMIN", "STAFF"), restaurantController.createOrder);
router.put("/update-order", authenticate, authorize("ADMIN", "STAFF"), restaurantController.updateOrderDetails);
router.get("/notifications",authenticate, authorize("ADMIN", "STAFF"), restaurantController.getNotifications);

// allergy alerts — ADMIN + STAFF
router.get("/alerts",       authenticate, authorize("ADMIN", "STAFF"), restaurantController.getAllergyAlerts);

// inventory — ADMIN only
router.post("/add-inventory",    authenticate, authorize("ADMIN"), restaurantController.addItemsToInventory);
router.get("/inventory",         authenticate, authorize("ADMIN", "STAFF"), restaurantController.getInventoryItems);
router.put("/inventory/:id",     authenticate, authorize("ADMIN"), restaurantController.updateInventoryItem);
router.delete("/inventory/:id",  authenticate, authorize("ADMIN"), restaurantController.deleteInventoryItem);

// tables — public (QR scan needs this)
router.get("/tables", restaurantController.getTables);
router.patch("/tables/:tableNo/available", authenticate, authorize("ADMIN", "STAFF"), restaurantController.markTableAvailable);

// manager metrics — ADMIN only
router.get("/metrics", authenticate, authorize("ADMIN"), restaurantController.getManagerMetrics);

// dishes — ADMIN only
router.post("/add-dish",    authenticate, authorize("ADMIN"), restaurantController.addDish);
router.put("/update-dish",  authenticate, authorize("ADMIN"), restaurantController.updateDish);
router.delete("/dish/:id",  authenticate, authorize("ADMIN"), restaurantController.deleteDish);

module.exports = router;