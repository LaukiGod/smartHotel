const jwt = require("jsonwebtoken");

/** Sentinel slug used by the platform (SUPER_ADMIN) login flow. */
const PLATFORM_SCOPE = "__platform__";

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });

const verify = (token) => jwt.verify(token, process.env.JWT_SECRET);

/**
 * Access token for a staff member. The tenant is baked into the token so an
 * authenticated request can be checked against the tenant in the URL without a
 * database round-trip.
 */
const signStaffToken = (staff, restaurant) =>
  sign({
    id: String(staff._id),
    role: staff.role,
    name: staff.name,
    email: staff.email,
    restaurantId: restaurant ? String(restaurant._id) : null,
    restaurantSlug: restaurant ? restaurant.slug : null,
  });

/**
 * Google sends `state` back untouched, so we sign it. This carries the tenant
 * across the OAuth round-trip (Google only allows a fixed set of redirect URIs,
 * so the callback URL itself cannot be per-tenant) and doubles as CSRF defence.
 */
const signOAuthState = (slug) =>
  jwt.sign({ slug, n: Math.random().toString(36).slice(2) }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });

const verifyOAuthState = (state) => {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (!payload?.slug) throw new Error("OAuth state is missing the tenant");
  return payload;
};

module.exports = {
  sign,
  verify,
  signStaffToken,
  signOAuthState,
  verifyOAuthState,
  PLATFORM_SCOPE,
};
