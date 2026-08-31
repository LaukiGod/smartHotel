const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
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
    enum: ["created", "confirmed", "preparing", "served", "completed"],
    default: "created"
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

// Dashboard reads "today's orders for this restaurant"; tracking reads
// "open orders for this table"; both stay index-covered.
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, tableNo: 1, status: 1 });
orderSchema.index({ restaurant: 1, allergyAlert: 1 });

module.exports = mongoose.model("Order", orderSchema);
