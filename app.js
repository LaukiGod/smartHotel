const express = require("express");

const userRoutes = require("./routes/user.routes");
const restaurantRoutes = require("./routes/restaurant.routes");

const staffAuthRoutes = require("./routes/staffAuth.routes");

require("./config/passport");

const app = express();

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