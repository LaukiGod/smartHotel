const Restaurant = require("../entities/restaurant.entity");
const { scoped } = require("../utils/tenantScope");

/**
 * Slug -> restaurant cache. Restaurants change rarely and are read on every
 * single request, so a short TTL cache keeps the tenant lookup off the hot path
 * without making suspensions take effect only after a restart.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map();

function cacheGet(slug) {
  const hit = cache.get(slug);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(slug);
    return null;
  }
  return hit.doc;
}

function cacheSet(slug, doc) {
  cache.set(slug, { doc, at: Date.now() });
}

/** Called after a restaurant is edited or suspended so the change lands immediately. */
function invalidateTenant(slug) {
  if (slug) cache.delete(slug);
  else cache.clear();
}

/**
 * Resolves `:slug` into `req.restaurant` / `req.restaurantId` / `req.db`.
 * Every tenant-scoped router mounts behind this.
 */
const resolveTenant = async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase().trim();
    if (!slug) {
      return res.status(400).json({ message: "Restaurant slug is required" });
    }

    let restaurant = cacheGet(slug);
    if (!restaurant) {
      restaurant = await Restaurant.findOne({ slug });
      if (restaurant) cacheSet(slug, restaurant);
    }

    if (!restaurant) {
      return res.status(404).json({ message: `Restaurant "${slug}" not found` });
    }
    if (restaurant.status !== "active") {
      return res.status(403).json({ message: `Restaurant "${restaurant.name}" is suspended` });
    }

    req.restaurant = restaurant;
    req.restaurantId = restaurant._id;
    req.db = scoped(restaurant._id);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Rejects a token issued for restaurant A being replayed against restaurant B.
 * Runs after `authenticate`, which populates `req.staff` from the JWT.
 *
 * SUPER_ADMIN is allowed through any tenant — that is the point of the role.
 */
const enforceTenantMatch = (req, res, next) => {
  if (!req.staff) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.staff.role === "SUPER_ADMIN") return next();

  if (!req.restaurantId) {
    return res.status(500).json({ message: "Tenant not resolved for this route" });
  }
  if (String(req.staff.restaurantId) !== String(req.restaurantId)) {
    return res.status(403).json({ message: "This account does not belong to this restaurant" });
  }
  next();
};

module.exports = { resolveTenant, enforceTenantMatch, invalidateTenant };
