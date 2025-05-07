import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";
dotenv.config();
import session from 'express-session';
import passport from './config/passport.js';
import userRoutes from "./routes/userRoutes.js";
import airportRoutes from "./routes/aiportRoutes.js";
import flightRoutes from "./routes/fightRoutes.js";
import refundsRoutes from "./routes/refundsRoutes.js"
import contactUsRoutes from "./routes/contactUsRoutes.js"

// import bookingRoutes from "./routes/bookingRoutes.js";
// import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
  
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));


app.use(passport.initialize());
app.use(passport.session());

app.use("/api/users", userRoutes);
app.use("/api/airports", airportRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/refunds", refundsRoutes);
app.use("/api/contactUs", contactUsRoutes);
// app.use("/api/bookings", bookingRoutes);
// app.use("/api/payments", paymentRoutes);

export default app;