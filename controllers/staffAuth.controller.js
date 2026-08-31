const Staff = require("../entities/staff.entity");
const { signStaffToken, signOAuthState, PLATFORM_SCOPE } = require("../utils/jwt");

const frontendBase = () => String(process.env.FRONTEND_URL || "").replace(/\/+$/, "");

/** Step 1 — hand Passport a signed `state` carrying the tenant slug. */
exports.oauthStateFor = (slug) => signOAuthState(slug);

/**
 * Step 2 — Google came back and Passport resolved `{ staff, restaurant, slug }`.
 * Issue a tenant-stamped JWT and bounce to that tenant's callback route.
 */
exports.googleCallback = (req, res) => {
  const { staff, restaurant, slug } = req.user;
  const token = signStaffToken(staff, restaurant);

  const target =
    slug === PLATFORM_SCOPE
      ? `${frontendBase()}/platform/auth/callback`
      : `${frontendBase()}/r/${slug}/auth/callback`;

  res.redirect(`${target}?token=${token}`);
};

exports.googleFailure = (req, res) => {
  const reason = req.query.reason || "Google authentication failed or access denied";
  res.status(401).json({ message: reason });
};

// ADMIN only: pre-register a staff email + role, scoped to the caller's restaurant.
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "name, email, and role are required" });
    }
    if (!["ADMIN", "STAFF"].includes(role)) {
      return res.status(400).json({ message: "Role must be ADMIN or STAFF" });
    }

    const normalized = String(email).toLowerCase().trim();
    const exists = await Staff.findOne({ restaurant: req.restaurantId, email: normalized });
    if (exists) {
      return res.status(409).json({ message: "Email already registered at this restaurant" });
    }

    // googleId is null until they first log in with Google
    const staff = await Staff.create({
      restaurant: req.restaurantId,
      name,
      email: normalized,
      role,
      googleId: null,
    });

    res.status(201).json({
      message: "Staff pre-registered",
      id: staff._id,
      role: staff.role,
      email: staff.email,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Every staff mutation below is filtered by restaurant, so one tenant's ADMIN
 *  cannot touch another tenant's staff even with a valid id. */
const findInTenant = (req) => ({ _id: req.params.id, restaurant: req.restaurantId });

exports.deactivateStaff = async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ message: "Cannot deactivate your own account" });
    }
    const staff = await Staff.findOneAndUpdate(findInTenant(req), { isActive: false }, { new: true });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff deactivated", id: staff._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.activateStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndUpdate(findInTenant(req), { isActive: true }, { new: true });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff activated", id: staff._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const staff = await Staff.findOneAndDelete(findInTenant(req));
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listStaff = async (req, res) => {
  try {
    const staff = await Staff.find({ restaurant: req.restaurantId }, "-googleId").sort({
      createdAt: -1,
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Own profile, plus the restaurant this session is bound to.
exports.me = (req, res) => {
  res.json({
    ...req.staff,
    restaurant: req.restaurant ? req.restaurant.toPublicJSON() : null,
  });
};
