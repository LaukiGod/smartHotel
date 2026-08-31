require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const platformRoutes = require("./routes/platform.routes");
const userRoutes = require("./routes/user.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const staffAuthRoutes = require("./routes/staffAuth.routes");
require("./config/passport");

const app = express();

// CORS — must be before all routes
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://restaurant-management-nepal.vercel.app",
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// middleware
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
//
// Two kinds of route live here:
//
//   /api/auth/*       and  /api/platform/*   — platform level, no tenant
//   /api/r/:slug/*                           — tenant level, everything else
//
// The `:slug` segment is the tenant boundary. `resolveTenant` (mounted inside
// each tenant router) turns it into `req.restaurant` and a scoped `req.db`, and
// every downstream query runs through that scope.

// Google OAuth callback is global — Google only allows fixed redirect URIs, so
// the tenant rides along in the signed `state` parameter instead.
app.use("/api/auth", authRoutes);

// SUPER_ADMIN console: create, suspend and inspect restaurants.
app.use("/api/platform", platformRoutes);

// Tenant-scoped surfaces.
app.use("/api/r/:slug/auth", staffAuthRoutes);
app.use("/api/r/:slug/restaurant", restaurantRoutes);
app.use("/api/r/:slug/user", userRoutes);

// health check route
app.get("/", (req, res) => {
  res.send("Hotel Management API Running (multi-tenant)");
});

// 404 for unmatched API routes — otherwise a typo'd tenant path returns the
// health-check HTML and the frontend fails with a confusing JSON parse error.
app.use("/api", (req, res) => {
  res.status(404).json({ message: `No API route for ${req.method} ${req.originalUrl}` });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

module.exports = app;
