const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  tableNo: {
    type: Number,
    required: true,
    unique: true
  },

  status: {
    type: String,
    enum: ["free", "occupied"],
    default: "free"
  },

  currentUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

module.exports = mongoose.model("Table", tableSchema);