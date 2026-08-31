/**
 * Global auth routes — the parts of the OAuth dance that cannot be per-tenant.
 *
 * Google requires the redirect URI to be registered up front, so there is exactly
 * one callback URL for the whole platform. The tenant is carried in the signed
 * `state` parameter and unpacked by the Google strategy.
 */
const express = require("express");
const router = express.Router();
const passport = require("passport");

const authController = require("../controllers/staffAuth.controller");
const { signOAuthState, PLATFORM_SCOPE } = require("../utils/jwt");

// Step 1 (platform): SUPER_ADMIN login — no tenant to resolve.
router.get("/platform/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: signOAuthState(PLATFORM_SCOPE),
  })(req, res, next);
});

// Step 2 (everyone): Google redirects here for tenant staff and platform admins alike.
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/api/auth/failed" }),
  authController.googleCallback
);

router.get("/failed", authController.googleFailure);

module.exports = router;
