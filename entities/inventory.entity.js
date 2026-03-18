// models/Inventory.js

const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  quantity: {
    type: Number,
    required: true,
    min: 0
  },

  unit: {
    type: String,
    enum: ["kg", "grams", "litres", "ml", "pieces", "packets"],
    required: true
  },

  category: {
    type: String,
    enum: ["vegetable", "fruit", "dairy", "meat", "spice", "beverage", "other"],
    default: "other"
  },

  lowStockThreshold: {
    type: Number,
    default: 10
  },

  expiryDate: {
    type: Date,
    default: null   // null = no expiry
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Inventory", inventorySchema);