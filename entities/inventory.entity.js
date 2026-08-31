// models/Inventory.js

const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true
  },

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

// Name uniqueness is enforced case-insensitively in the service; this index
// only keeps per-restaurant lookups fast.
inventorySchema.index({ restaurant: 1, name: 1 });

module.exports = mongoose.model("Inventory", inventorySchema);
