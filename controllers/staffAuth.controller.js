const { sign } = require("../utils/jwt");
const Staff = require("../entities/staff.entity");

// Called after Google OAuth2 succeeds — issues JWT, redirects frontend
exports.googleCallback = (req, res) => {
  const staff = req.user;
  const token = sign({ id: staff._id, role: staff.role, name: staff.name, email: staff.email });

  const frontendURL = process.env.FRONTEND_URL;
  res.redirect(`${frontendURL}/auth/callback?token=${token}`);
};

// ADMIN only: pre-register a staff email + role before they log in with Google
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "name, email, and role are required" });
    }
    if (!["ADMIN", "STAFF"].includes(role)) {
      return res.status(400).json({ message: "Role must be ADMIN or STAFF" });
    }

    const exists = await Staff.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    // googleId is null until they first log in with Google
    const staff = await Staff.create({ name, email, role, googleId: null });
    res.status(201).json({ message: "Staff pre-registered", id: staff._id, role: staff.role, email: staff.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN only: deactivate (soft delete) — keeps history
exports.deactivateStaff = async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ message: "Cannot deactivate your own account" });
    }
    const staff = await Staff.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff deactivated", id: staff._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN only: reactivate
exports.activateStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff activated", id: staff._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN only: hard delete
exports.deleteStaff = async (req, res) => {
  try {
    if (req.params.id === req.staff.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN only: list all staff
exports.listStaff = async (req, res) => {
  try {
    const staff = await Staff.find({}, "-googleId").sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get own profile (any authenticated staff)
exports.me = (req, res) => {
  res.json(req.staff);
};