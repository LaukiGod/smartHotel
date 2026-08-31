/**
 * Tenant-scoped model access.
 *
 * Services never import Mongoose models directly any more. They receive a bundle
 * from `scoped(restaurantId)`, where every read is filtered by `restaurant` and
 * every write is stamped with it. Forgetting the filter stops being possible,
 * which is the whole point — a single missed `{ restaurant }` in a 1000-line
 * service is a cross-tenant data leak.
 *
 * `findById` is deliberately rewritten to `findOne({ _id, restaurant })` so an
 * attacker who guesses another restaurant's ObjectId gets a 404, not their data.
 */

const mongoose = require("mongoose");

const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const Inventory = require("../entities/inventory.entity");
const Table = require("../entities/table.entity");
const User = require("../entities/user.entity");
const Staff = require("../entities/staff.entity");

class TenantScopedModel {
  constructor(model, restaurantId) {
    this.model = model;
    this.restaurantId = restaurantId;
  }

  /** Merge the tenant filter last so a caller can never override it. */
  where(filter) {
    return { ...(filter || {}), restaurant: this.restaurantId };
  }

  stamp(doc) {
    return { ...(doc || {}), restaurant: this.restaurantId };
  }

  find(filter, projection, options) {
    return this.model.find(this.where(filter), projection, options);
  }

  findOne(filter, projection, options) {
    return this.model.findOne(this.where(filter), projection, options);
  }

  findById(id, projection, options) {
    if (!mongoose.Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findOne(this.where({ _id: id }), projection, options);
  }

  findOneAndUpdate(filter, update, options) {
    return this.model.findOneAndUpdate(this.where(filter), update, options);
  }

  findByIdAndUpdate(id, update, options) {
    if (!mongoose.Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findOneAndUpdate(this.where({ _id: id }), update, options);
  }

  findByIdAndDelete(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findOneAndDelete(this.where({ _id: id }));
  }

  create(docs) {
    if (Array.isArray(docs)) return this.model.create(docs.map((d) => this.stamp(d)));
    return this.model.create(this.stamp(docs));
  }

  insertMany(docs, options) {
    const list = Array.isArray(docs) ? docs : [docs];
    return this.model.insertMany(list.map((d) => this.stamp(d)), options);
  }

  countDocuments(filter) {
    return this.model.countDocuments(this.where(filter));
  }

  updateMany(filter, update, options) {
    return this.model.updateMany(this.where(filter), update, options);
  }

  updateOne(filter, update, options) {
    return this.model.updateOne(this.where(filter), update, options);
  }

  deleteOne(filter) {
    return this.model.deleteOne(this.where(filter));
  }

  deleteMany(filter) {
    return this.model.deleteMany(this.where(filter));
  }

  distinct(field, filter) {
    return this.model.distinct(field, this.where(filter));
  }

  aggregate(pipeline) {
    return this.model.aggregate([{ $match: { restaurant: this.restaurantId } }, ...pipeline]);
  }
}

const REGISTRY = { Order, Dish, Inventory, Table, User, Staff };

/**
 * @param {mongoose.Types.ObjectId|string} restaurantId
 * @returns {{Order:TenantScopedModel, Dish:TenantScopedModel, Inventory:TenantScopedModel,
 *            Table:TenantScopedModel, User:TenantScopedModel, Staff:TenantScopedModel,
 *            restaurantId: mongoose.Types.ObjectId}}
 */
function scoped(restaurantId) {
  if (!restaurantId) {
    throw new Error("scoped() requires a restaurantId — refusing to run an unscoped query");
  }

  const rid =
    restaurantId instanceof mongoose.Types.ObjectId
      ? restaurantId
      : new mongoose.Types.ObjectId(String(restaurantId));

  const bundle = { restaurantId: rid };
  for (const [name, model] of Object.entries(REGISTRY)) {
    bundle[name] = new TenantScopedModel(model, rid);
  }
  return bundle;
}

module.exports = { scoped, TenantScopedModel };
