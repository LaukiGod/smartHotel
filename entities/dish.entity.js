const mongoose = require("mongoose");

const dishSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true
  },

  dishId: {
    type: Number
  },

  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    default: "General",
    trim: true
  },

  price: {
    type: Number,
    required: true
  },

  ingredients: [
    {
      type: String,
    }
  ],

  recipe: {
    type: String,
    default: ""
  },

  imageUrl: {
    type: String,
  },

  isAvailable: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// dishId is a per-restaurant counter, not a global one.
dishSchema.index({ restaurant: 1, dishId: 1 }, { unique: true });
dishSchema.index({ restaurant: 1, category: 1, name: 1 });

module.exports = mongoose.model("Dish", dishSchema);
