const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true
  },

  tableNo: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["available", "occupied", "cleaning"],
    default: "available"
  },

  allergyAlert: {
    type: Boolean,
    default: false
  },

  currentUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  waiterRequested: {
    type: Boolean,
    default: false
  },

  occupiedSince: {
    type: Date,
    default: null
  },

  lastStatusChangedAt: {
    type: Date,
    default: Date.now
  }
});

// Table numbers restart at 1 for every restaurant.
tableSchema.index({ restaurant: 1, tableNo: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);
