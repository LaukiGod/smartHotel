const mongoose = require("mongoose");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  /** URL identity — every tenant-scoped route is /api/r/:slug/... */
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => SLUG_RE.test(v),
      message: "slug must be lowercase alphanumeric words separated by single hyphens",
    },
  },

  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active",
  },

  contactEmail: {
    type: String,
    default: "",
    lowercase: true,
    trim: true,
  },

  phone: {
    type: String,
    default: "",
    trim: true,
  },

  address: {
    type: String,
    default: "",
    trim: true,
  },

  currency: {
    type: String,
    default: "NPR",
    trim: true,
  },

  /** Branding surfaced to the public kiosk/customer apps. */
  logoUrl: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

restaurantSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    name: this.name,
    slug: this.slug,
    status: this.status,
    currency: this.currency,
    logoUrl: this.logoUrl,
  };
};

module.exports = mongoose.model("Restaurant", restaurantSchema);
module.exports.SLUG_RE = SLUG_RE;
