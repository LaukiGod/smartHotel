const express = require("express");
// mergeParams keeps :slug readable after mounting under /api/r/:slug/user
const router = express.Router({ mergeParams: true });
const userController = require("../controllers/user.controller");
const { resolveTenant } = require("../middlewares/tenant.middleware");

// Public customer surface — unauthenticated, but always pinned to one restaurant.
router.use(resolveTenant);

// Restaurant identity for the kiosk/customer shell
router.get("/restaurant", userController.getRestaurantInfo);

// login and start a table session
router.post("/login-table", userController.loginTable);

// quick QR entry
router.get("/table-select/:tableNo", userController.selectTableQuickBrowse);

// set allergies for the seated user
router.post("/set-allergies", userController.setAllergies);

// browse the menu
router.get("/menu", userController.getMenu);

// read the current seating session
router.get("/table-session/:tableNo", userController.getTableSession);

// ordering
router.post("/order", userController.orderFood);
router.post("/confirm-order", userController.confirmOrder);
router.get("/orders/:tableNo", userController.getTableOrders);
router.post("/call-waiter", userController.callWaiter);
router.post("/meal-complete", userController.completeMeal);
router.post("/review", userController.submitReview);

// end the session
router.post("/clear-table", userController.clearTable);

module.exports = router;
