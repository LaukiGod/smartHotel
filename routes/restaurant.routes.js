const express = require("express");
// mergeParams keeps :slug readable after mounting under /api/r/:slug/restaurant
const router = express.Router({ mergeParams: true });
const restaurantController = require("../controllers/restaurant.controller");
const { authenticate, authorize } = require("../middlewares/staffAuth.middleware");
const { resolveTenant, enforceTenantMatch } = require("../middlewares/tenant.middleware");

// Resolve the tenant first, then require a token issued FOR THAT TENANT.
router.use(resolveTenant);

/** authenticate -> confirm the token's restaurant matches the URL -> check role. */
const staff = [authenticate, enforceTenantMatch, authorize("ADMIN", "STAFF")];
const adminOnly = [authenticate, enforceTenantMatch, authorize("ADMIN")];

// ── Orders ────────────────────────────────────────────────────────────────────
router.get("/orders",            staff, restaurantController.getOrders);
router.post("/order-status",     staff, restaurantController.updateOrderStatus);
router.post("/line-item-status", staff, restaurantController.updateLineItemStatus);
router.post("/create-order",     staff, restaurantController.createOrder);
router.put("/update-order",      staff, restaurantController.updateOrderDetails);
router.get("/notifications",     staff, restaurantController.getNotifications);

// ── Allergy alerts ────────────────────────────────────────────────────────────
router.get("/alerts",            staff, restaurantController.getAllergyAlerts);

// ── Inventory ─────────────────────────────────────────────────────────────────
router.post("/add-inventory",    adminOnly, restaurantController.addItemsToInventory);
router.get("/inventory",         staff,     restaurantController.getInventoryItems);
router.put("/inventory/:id",     adminOnly, restaurantController.updateInventoryItem);
router.delete("/inventory/:id",  adminOnly, restaurantController.deleteInventoryItem);

// ── Tables ────────────────────────────────────────────────────────────────────
// Table list is readable without a token (the kiosk uses it), but only ever for
// the restaurant named in the URL.
router.get("/tables", restaurantController.getTables);
router.patch("/tables/:tableNo/available", staff, restaurantController.markTableAvailable);
router.get("/tables/count",     adminOnly, restaurantController.getTableCount);
router.post("/tables/increase", adminOnly, restaurantController.increaseTableCount);
router.delete("/tables/:id",    adminOnly, restaurantController.deleteTableById);

// ── Metrics ───────────────────────────────────────────────────────────────────
router.get("/metrics", adminOnly, restaurantController.getManagerMetrics);

// ── Menu ──────────────────────────────────────────────────────────────────────
router.get("/menu",        staff,     restaurantController.getAllDishes);
router.post("/add-dish",   adminOnly, restaurantController.addDish);
router.put("/update-dish", adminOnly, restaurantController.updateDish);
router.delete("/dish/:id", adminOnly, restaurantController.deleteDish);

// ── QR ────────────────────────────────────────────────────────────────────────
router.get("/tables/:tableNo/qrcode", staff, restaurantController.generateTableQRCode);

module.exports = router;
