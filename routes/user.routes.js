const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");

// login using table number
router.post("/login-table", userController.loginTable);

// set allergies
router.post("/set-allergies", userController.setAllergies);

// get menu
router.get("/menu", userController.getMenu);

// order food
router.post("/order", userController.orderFood);
router.post("/pay", userController.payOrder);
router.get("/orders/:tableNo", userController.getTableOrders);
router.post("/call-waiter", userController.callWaiter);
router.post("/meal-complete", userController.completeMeal);
router.post("/review", userController.submitReview);

// clear table when leaving
router.post("/clear-table", userController.clearTable);

module.exports = router;