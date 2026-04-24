const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  tableNo: {
    type: Number,
    required: true,
    unique: true
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

module.exports = mongoose.model("Table", tableSchema);