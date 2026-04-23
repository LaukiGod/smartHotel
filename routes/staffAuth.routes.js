const express = require("express");
const router = express.Router();
const passport = require("passport");

const authController = require("../controllers/staffAuth.controller");
const { authenticate, authorize } = require("../middlewares/staffAuth.middleware");

// ── OAuth2 ────────────────────────────────────────────────────────────────────

// Step 1: redirect to Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

// Step 2: Google callback → JWT → redirect frontend
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/api/auth/failed" }),
  authController.googleCallback
);

router.get("/failed", (_req, res) => {
  res.status(401).json({ message: "Google authentication failed or access denied" });
});

// ── Self ──────────────────────────────────────────────────────────────────────

router.get("/me", authenticate, authController.me);

// ── ADMIN: staff management ───────────────────────────────────────────────────

router.get("/staff",           authenticate, authorize("ADMIN"), authController.listStaff);
router.post("/staff",          authenticate, authorize("ADMIN"), authController.registerStaff);
router.patch("/staff/:id/deactivate", authenticate, authorize("ADMIN"), authController.deactivateStaff);
router.patch("/staff/:id/activate",   authenticate, authorize("ADMIN"), authController.activateStaff);
router.delete("/staff/:id",    authenticate, authorize("ADMIN"), authController.deleteStaff);

module.exports = router;