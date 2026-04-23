const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const Staff = require("../entities/staff.entity");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, // e.g. http://localhost:5000/api/auth/google/callback
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from Google"), null);

        let staff = await Staff.findOne({ googleId: profile.id });

        if (!staff) {
          // Check if this Google email was pre-registered by admin
          staff = await Staff.findOne({ email });

          if (!staff) {
            // Not a registered staff member — deny access
            return done(null, false, { message: "Access denied: not a registered staff member" });
          }

          // Link Google account to pre-registered email
          staff.googleId = profile.id;
          staff.avatar = profile.photos?.[0]?.value;
          await staff.save();
        }

        if (!staff.isActive) {
          return done(null, false, { message: "Account is deactivated" });
        }

        return done(null, staff);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;  