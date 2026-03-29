const mongoose = require("mongoose");

const dishSchema = new mongoose.Schema({
  dishId: {
    type: Number,
    unique: true
  },

  name: {
    type: String,
    required: true
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

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Dish", dishSchema);