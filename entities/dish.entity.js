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
    default: "https://static.vecteezy.com/system/resources/thumbnails/031/415/218/small/top-view-delicious-food-plate-on-a-black-background-ai-generated-photo.jpg"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Dish", dishSchema);