import express from 'express';
import passport from '../middleware/authentication.js';
import { TOTP } from 'otpauth';

import {
    getUserById,
    resetUserScore,
    updateLastTotpStep
} from '../dao.js';

const router = express.Router();

//function to verify the TOTP
function verifyTotpToken(user, token) {
    const totp = new TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: user.totp_secret
    });

    //validate checks the token validity
    const delta = totp.validate({ token, window: 1 }); 

    if (delta === null) { //delta can be -1 0 o +1
        return false; //invalid code
    }

    const currentCounter = totp.counter(); //counter return the number of the currently valid token
    const actualStep = currentCounter + delta;

    //anti replay
    if (user.lastTotpStep != null && actualStep <= user.lastTotpStep) {
        return false;
    }

    user.lastTotpStep = actualStep;

    return true;
}


// POST /api/sessions
router.post('/sessions', (req, res, next) => {
    passport.authenticate('local', (err, user) => { //execute the passport.use of authentication

        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        //if the user choose to use 2fa
        if (req.body.use2fa === true) {
            req.session.pending2FAUserId = user.id;
            return req.session.save((err) => {
                if (err) {
                    return next(err);
                }
                return res.json({
                    requires2FA: true
                });
            });
        }

        //login without 2fa
        req.logIn(user, (err) => { //passport method, after successful login
            if (err) {
                return next(err);
            }
            return res.json({
                id: user.id,
                username: user.username,
                score: user.score
            });
        });

    })(req, res, next);
});


// POST /api/sessions/2fa
router.post('/sessions/2fa', async (req, res, next) => {
    try {
        const userId = req.session.pending2FAUserId;
        if (!userId) {
            return res.status(401).json({
                error: '2FA verification not started'
            });
        }

        const { token } = req.body;
        if (!token || !/^\d{6}$/.test(String(token))) {
            return res.status(400).json({
                error: 'Invalid TOTP code'
            });
        }

        const user = await getUserById(userId);
        if (!user) {
            return res.status(401).json({
                error: 'User not found'
            });
        }

        const isValid = verifyTotpToken(user, String(token));
        if (!isValid) {
            return res.status(401).json({
                error: 'Invalid TOTP code'
            });
        }

        req.logIn(user, async (err) => {
            if (err) {
                return next(err);
            }
            try {
                await updateLastTotpStep(user.id, user.lastTotpStep);
            } catch (dbErr) {
                return next(dbErr);
            }
            if (user.score < 0) {
                await resetUserScore(user.id);
            }

            req.session.method = 'totp';
            delete req.session.pending2FAUserId;

            const updatedUser = await getUserById(user.id);
            return res.json({
                id: updatedUser.id,
                username: updatedUser.username,
                score: updatedUser.score
            });
        });

    } catch (err) {
        next(err);
    }
});


// DELETE /api/sessions/current
router.delete('/sessions/current', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }

        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }

            res.clearCookie('connect.sid');
            return res.status(204).end();
        });
    });
});


// GET /api/sessions/current
router.get('/sessions/current', (req, res) => {

    if (!req.isAuthenticated()) { //passport method used to check the cookie
        return res.status(401).json({
            error: 'Not authenticated'
        });
    }

    return res.json({
        id: req.user.id,
        username: req.user.username,
        score: req.user.score
    });
});

// DELETE /api/sessions/2fa
router.delete('/sessions/2fa', (req, res) => {

    delete req.session.pending2FAUserId;
    req.session.save((err) => {
        if (err) {
            return res.status(500).json({
                error: 'Internal server error'
            });
        }
        return res.status(204).end();
    });
});

export default router;