const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  /**
   * The restaurant this staff member belongs to.
   * null for SUPER_ADMIN, who operates above every tenant.
   */
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default: null,
    index: true,
  },

  googleId: {
    type: String,
    default: null,
  },

  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    lowercase: true,
  },

  avatar: {
    type: String,
    default: null,
  },

  role: {
    type: String,
    enum: ["SUPER_ADMIN", "ADMIN", "STAFF"],
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

// The same person may legitimately work at two restaurants, so identity is
// unique per tenant rather than globally. (restaurant: null covers SUPER_ADMIN.)
staffSchema.index({ restaurant: 1, email: 1 }, { unique: true });
staffSchema.index(
  { restaurant: 1, googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: "string" } } }
);

// Mongoose 9 calls document pre-hooks without a `next` callback, so this is a
// plain sync hook: return to continue, throw to reject.
staffSchema.pre("validate", function enforceTenantForNonPlatformRoles() {
  if (this.role === "SUPER_ADMIN") {
    this.restaurant = null;
    return;
  }
  if (!this.restaurant) {
    throw new Error("restaurant is required for ADMIN and STAFF accounts");
  }
});

module.exports = mongoose.model("Staff", staffSchema);
