const Staff = require("../entities/staff.entity");
const { generateTokens, verifyRefresh } = require("../utils/jwt");

// Store refresh tokens in memory (swap for Redis in production)
const refreshTokenStore = new Set();

exports.login = async ({ email, password }) => {
  if (!email || !password) throw new Error("Email and password are required");

  const staff = await Staff.findOne({ email, isActive: true });
  if (!staff) throw new Error("Invalid credentials");

  const valid = await staff.comparePassword(password);
  if (!valid) throw new Error("Invalid credentials");

  const payload = { id: staff._id, role: staff.role, name: staff.name };
  const tokens = generateTokens(payload);

  refreshTokenStore.add(tokens.refreshToken);

  return { ...tokens, role: staff.role, name: staff.name };
};

exports.refresh = ({ refreshToken }) => {
  if (!refreshToken) throw new Error("Refresh token required");
  if (!refreshTokenStore.has(refreshToken)) throw new Error("Invalid refresh token");

  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    refreshTokenStore.delete(refreshToken);
    throw new Error("Expired or invalid refresh token");
  }

  refreshTokenStore.delete(refreshToken);

  const newPayload = { id: payload.id, role: payload.role, name: payload.name };
  const tokens = generateTokens(newPayload);
  refreshTokenStore.add(tokens.refreshToken);

  return tokens;
};

exports.logout = ({ refreshToken }) => {
  if (refreshToken) refreshTokenStore.delete(refreshToken);
  return { message: "Logged out" };
};

// Call once on startup to ensure at least one ADMIN exists
exports.seedAdmin = async () => {
  const exists = await Staff.findOne({ role: "ADMIN" });
  if (exists) return;

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("[Auth] No ADMIN found. Set ADMIN_EMAIL & ADMIN_PASSWORD in .env to auto-seed.");
    return;
  }

  await Staff.create({ name: ADMIN_NAME || "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "ADMIN" });
  console.log("[Auth] Admin seeded:", ADMIN_EMAIL);
};