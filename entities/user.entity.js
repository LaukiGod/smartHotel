const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
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
    required: true,
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

module.exports = mongoose.model("User", userSchema);