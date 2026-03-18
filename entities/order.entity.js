const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  tableNo: {
    type: Number,
    required: true
  },

  dishes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dish"
    }
  ],

  allergiesInput: {
    type: [String],
    default: []
  },

  allergyAlert: {
    type: Boolean,
    default: false
  },

  status: {
    type: String,
    enum: ["pending", "preparing", "served"],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);