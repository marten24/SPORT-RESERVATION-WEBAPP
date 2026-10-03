import passport from 'passport'; //authentication middleware to authenticate users in express
import { Strategy as LocalStrategy } from 'passport-local';
import crypto from 'crypto';

import {
    getUserByUsername,
    getUserById
} from '../dao.js';

passport.use(
    //strategy based on username and password
    new LocalStrategy(async (username, password, done) => { 
        try {
            const user = await getUserByUsername(username);

            if (!user) {
                return done(null, false);
            }

            const salt = user.salt;

            crypto.scrypt(password, salt, 32, (err, hashedPassword) => {
                if (err) {
                    return done(err);
                }

                const storedHash = Buffer.from(user.password_hash, 'hex'); 

                let passwordsMatch;

                try {
                    passwordsMatch = crypto.timingSafeEqual(storedHash, hashedPassword);
                } catch {
                    passwordsMatch = false;
                }

                if (!passwordsMatch) {
                    return done(null, false);
                }

                return done(null, user);
            });

        } catch (err) {
            return done(err);
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});


passport.deserializeUser(async (id, done) => {
    try {
        const user = await getUserById(id);

        if (!user) {
            return done(null, false);
        }

        done(null, user);
    } catch (err) {
        done(err);
    }
});

export default passport;