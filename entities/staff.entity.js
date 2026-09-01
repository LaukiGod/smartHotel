const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true, // omitted (not null) until first Google login, so multiple pre-registered staff can coexist
  },

  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  avatar: {
    type: String,
    default: null,
  },

  role: {
    type: String,
    enum: ["ADMIN", "STAFF"],
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Staff", staffSchema);