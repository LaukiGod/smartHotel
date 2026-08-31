const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");

const Staff = require("../entities/staff.entity");
const Restaurant = require("../entities/restaurant.entity");
const { verifyOAuthState, PLATFORM_SCOPE } = require("../utils/jwt");

/**
 * Google only permits a fixed list of redirect URIs, so the callback URL stays
 * global (`/api/auth/google/callback`) and the tenant travels in the signed
 * `state` parameter instead. `passReqToCallback` is what lets the verify
 * function read it back.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, _accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(null, false, { message: "No email from Google" });

        let state;
        try {
          state = verifyOAuthState(req.query.state);
        } catch {
          return done(null, false, { message: "Login link expired — please try again" });
        }

        const { slug } = state;

        // ── Platform (SUPER_ADMIN) login ──────────────────────────────────────
        if (slug === PLATFORM_SCOPE) {
          const admin = await Staff.findOne({ restaurant: null, email, role: "SUPER_ADMIN" });
          if (!admin) {
            return done(null, false, { message: "Not a platform administrator" });
          }
          if (!admin.isActive) return done(null, false, { message: "Account is deactivated" });

          if (!admin.googleId) {
            admin.googleId = profile.id;
            admin.avatar = profile.photos?.[0]?.value;
            await admin.save();
          }
          return done(null, { staff: admin, restaurant: null, slug });
        }

        // ── Tenant staff login ────────────────────────────────────────────────
        const restaurant = await Restaurant.findOne({ slug });
        if (!restaurant) return done(null, false, { message: "Restaurant not found" });
        if (restaurant.status !== "active") {
          return done(null, false, { message: "This restaurant is suspended" });
        }

        // Scoped to this restaurant: the same Google account can be staff at
        // several restaurants, and must only ever match within the one it is
        // logging in to.
        const staff = await Staff.findOne({ restaurant: restaurant._id, email });
        if (!staff) {
          return done(null, false, { message: "Access denied: not a registered staff member" });
        }
        if (!staff.isActive) return done(null, false, { message: "Account is deactivated" });

        if (!staff.googleId) {
          staff.googleId = profile.id;
          staff.avatar = profile.photos?.[0]?.value;
          await staff.save();
        }

        return done(null, { staff, restaurant, slug });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
