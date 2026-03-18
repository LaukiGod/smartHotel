const express = require("express");

const userRoutes = require("./routes/user.routes");
const restaurantRoutes = require("./routes/restaurant.routes");

const app = express();

// middleware
app.use(express.json());


// routes
app.use("/api/user", userRoutes);
app.use("/api/restaurant", restaurantRoutes);

// health check route
app.get("/", (req, res) => {
  res.send("Hotel Management API Running");
});

module.exports = app;