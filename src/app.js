import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import passport from 'passport';
import { configurePassport } from './config/passport.js';

const app=express();

const allowedOrigins = [process.env.CORS_ORIGIN, process.env.FRONTEND_URL, process.env.PUBLIC_BASE_URL]
    .filter(Boolean)
    .flatMap((origin) => origin.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        statusCode: 429,
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: (_req, res) => res.statusCode === 304
}));
app.use(apiLimiter);

app.use(
    cors({
        origin: (origin, callback) => {
            if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
                return callback(null, true);
            }

            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Origin not allowed by CORS'));
        },
        credentials:true
    })
)

app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true,limit:"16kb"}));
app.use(express.static("public"))
app.use(cookieParser())
configurePassport();
app.use(passport.initialize());

app.get('/health', (_req, res) => {
    return res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});


import { errorhandler } from "./middlewares/error.middlewares.js";
import userRoutes from "./routes/user.route.js";
import productRoutes from "./routes/product.route.js";
import chatRoutes from "./routes/chat.route.js";
import reservationRoutes from "./routes/reservation.route.js";
import microsoftAuthRoutes from "./routes/microsoftAuth.route.js";

app.use("/api/users",userRoutes)
app.use("/api/products",productRoutes)
app.use("/api/chats",chatRoutes)
app.use("/api/reservations",reservationRoutes)
app.use("/", microsoftAuthRoutes)


app.use(errorhandler)
export {app};