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

  /** One entry per physical item (same dish × qty = multiple rows), with kitchen progress. */
  lineItems: [
    {
      dish: { type: mongoose.Schema.Types.ObjectId, ref: "Dish", required: true },
      status: {
        type: String,
        enum: ["queued", "preparing", "ready", "served"],
        default: "queued"
      }
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
    enum: ["created", "paid", "preparing", "served", "completed"],
    default: "created"
  },

  paymentMethod: {
    type: String,
    enum: ["UPI"],
    default: "UPI"
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid"],
    default: "pending"
  },

  upiReference: {
    type: String,
    default: ""
  },

  review: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, default: "" }
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);