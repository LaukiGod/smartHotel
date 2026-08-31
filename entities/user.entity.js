const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
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

  name: {
    type: String,
    required: true,
    trim: true
  },

  phoneNo: {
    type: String,
    default: "",
    trim: true
  },

  allergies: {
    type: [String],
    default: []
  },

  role: {
    type: String,
    enum: ["admin", "manager", "user"],
    default: "user"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.index({ restaurant: 1, tableNo: 1 });

module.exports = mongoose.model("User", userSchema);
