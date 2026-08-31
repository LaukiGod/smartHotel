const express = require("express");
// mergeParams keeps :slug visible after mounting under /api/r/:slug/auth
const router = express.Router({ mergeParams: true });
const passport = require("passport");

const authController = require("../controllers/staffAuth.controller");
const { authenticate, authorize } = require("../middlewares/staffAuth.middleware");
const { resolveTenant, enforceTenantMatch } = require("../middlewares/tenant.middleware");
const { signOAuthState } = require("../utils/jwt");

// Every route here is bound to one restaurant.
router.use(resolveTenant);

// ── OAuth2 ────────────────────────────────────────────────────────────────────

// Step 1: redirect to Google, carrying this restaurant's slug in signed state.
// The callback lands on the global /api/auth/google/callback.
router.get("/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: signOAuthState(req.restaurant.slug),
  })(req, res, next);
});

// ── Self ──────────────────────────────────────────────────────────────────────

router.get("/me", authenticate, enforceTenantMatch, authController.me);

// ── ADMIN: staff management, scoped to this restaurant ────────────────────────

router.get("/staff", authenticate, enforceTenantMatch, authorize("ADMIN"), authController.listStaff);
router.post("/staff", authenticate, enforceTenantMatch, authorize("ADMIN"), authController.registerStaff);
router.patch("/staff/:id/deactivate", authenticate, enforceTenantMatch, authorize("ADMIN"), authController.deactivateStaff);
router.patch("/staff/:id/activate", authenticate, enforceTenantMatch, authorize("ADMIN"), authController.activateStaff);
router.delete("/staff/:id", authenticate, enforceTenantMatch, authorize("ADMIN"), authController.deleteStaff);

module.exports = router;
