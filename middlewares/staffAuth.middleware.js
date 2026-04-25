const { verify } = require("../utils/jwt");

const authenticate = (req, res, next) => {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed token" });
  }

  try {
    req.staff = verify(header.split(" ")[1]);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Usage: authorize("ADMIN") or authorize("ADMIN", "STAFF")
const authorize = (...roles) => (req, res, next) => {
  if (!req.staff || !roles.includes(req.staff.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

module.exports = { authenticate, authorize };