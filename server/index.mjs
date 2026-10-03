//nodemon index.mjs
//npm run dev

import express from 'express';
import cors from 'cors';
import session from 'express-session';

import authRouter from './routes/auth.js';
import facilitiesRouter from './routes/facilities.js';
import reservationsRouter from './routes/reservations.js';

import passport from './middleware/authentication.js';

const app = express();
const port = 3001;

app.use(express.json());

const corsOptions = {
origin: 'http://localhost:5173',
credentials: true,
};
app.use(cors(corsOptions));

app.use(session({
    secret: 'web-applications-exam-secret',
    resave: false,
    saveUninitialized: false //no empty sessions
}));

app.use(passport.initialize());
app.use(passport.session());
app.use('/api', authRouter);
app.use('/api', facilitiesRouter);
app.use('/api', reservationsRouter);

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
