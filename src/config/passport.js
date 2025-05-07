import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { sql, poolPromise } from "../config/db.js";

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT * FROM Users WHERE email = @email');
        
        const user = result.recordset[0];
        
        if (!user) {
            return done(null, false, { message: 'Incorrect email.' });
        }
        
        const match = await bcrypt.compare(password, user.PasswordHash);
        if (!match) {
            return done(null, false, { message: 'Incorrect password.' });
        }
        
        return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.UserID);
});

passport.deserializeUser(async (userid, done) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userid', sql.Int, userid)
      .query('SELECT * FROM Users WHERE userid = @userid');

    const user = result.recordset[0];
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;