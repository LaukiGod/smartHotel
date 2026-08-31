const express = require("express");
const router = express.Router();

const platformController = require("../controllers/platform.controller");
const { authenticate, requireSuperAdmin } = require("../middlewares/staffAuth.middleware");

// Everything below the platform console is SUPER_ADMIN-only.
router.use(authenticate, requireSuperAdmin);

router.get("/me", platformController.me);
router.get("/stats", platformController.stats);

// ── Tenants ───────────────────────────────────────────────────────────────────
router.get("/restaurants", platformController.listRestaurants);
router.post("/restaurants", platformController.createRestaurant);
router.get("/restaurants/:id", platformController.getRestaurant);
router.patch("/restaurants/:id", platformController.updateRestaurant);
router.patch("/restaurants/:id/status", platformController.setRestaurantStatus);
router.delete("/restaurants/:id", platformController.deleteRestaurant);

// ── Platform administrators ───────────────────────────────────────────────────
router.get("/super-admins", platformController.listSuperAdmins);
router.post("/super-admins", platformController.addSuperAdmin);

module.exports = router;
