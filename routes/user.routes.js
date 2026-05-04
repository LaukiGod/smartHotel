const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");

// login using table number
router.post("/login-table", userController.loginTable);

// browse-first: GET table → open menu without guest details (details at order confirm). Optional ?redirect=1
router.get("/table-select/:tableNo", userController.selectTableQuickBrowse);

// set allergies
router.post("/set-allergies", userController.setAllergies);

// get menu
router.get("/menu", userController.getMenu);

// seated customer identity for this table (for session refresh / validation)
router.get("/table-session/:tableNo", userController.getTableSession);

// order food
router.post("/order", userController.orderFood);
router.post("/confirm-order", userController.confirmOrder);
router.get("/orders/:tableNo", userController.getTableOrders);
router.post("/call-waiter", userController.callWaiter);
router.post("/meal-complete", userController.completeMeal);
router.post("/review", userController.submitReview);

// clear table when leaving
router.post("/clear-table", userController.clearTable);

module.exports = router;