require("dotenv").config();
const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/user.routes");
const restaurantRoutes = require("./routes/restaurant.routes");
const staffAuthRoutes = require("./routes/staffAuth.routes");
require("./config/passport");

const app = express();

// CORS — must be before all routes
const allowedOrigins = [process.env.FRONTEND_URL, "http://127.0.0.1:5173"].filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// middleware
app.use(express.json());

// routes
app.use("/api/user", userRoutes);
app.use("/api/restaurant", restaurantRoutes);
app.use("/api/auth", staffAuthRoutes);

// health check route
app.get("/", (req, res) => {
  res.send("Hotel Management API Running");
});

module.exports = app;
