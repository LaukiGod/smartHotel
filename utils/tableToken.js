const crypto = require("crypto");

/** Opaque, URL-safe identifier for customer-facing QR links — never exposes the real table number. */
function generateTableToken() {
  return crypto.randomBytes(16).toString("base64url");
}

module.exports = { generateTableToken };
