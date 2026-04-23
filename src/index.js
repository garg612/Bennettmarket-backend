import 'dotenv/config';
import mongoose from 'mongoose';
import {app} from './app.js';
import connectdb from './db/index.js';

const port =process.env.PORT || 6000;
let server;

const requiredEnvVars = [
    "ACCESS_TOKEN_SECRET",
    "ACCESS_TOKEN_EXPIRY",
    "REFRESH_TOKEN_SECRET",
    "REFRESH_TOKEN_EXPIRY",
    "STUDENT_OTP_SECRET",
    "CLOUDNARY_CLOUD_NAME",
    "CLOUDNARY_API_KEY",
    "CLOUDNARY_API_SECRET",
    "PUBLIC_BASE_URL"
];

const missingEnvVars = requiredEnvVars.filter((variableName) => !process.env[variableName]?.trim());

const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
const hasMongoDirectUri = Boolean(process.env.MONGODB_DIRECT_URI?.trim());
const hasMongoBaseUrl = Boolean(process.env.MONGODB_URL?.trim());
const hasDbName = Boolean(process.env.DB_NAME?.trim());

if (!hasMongoUri && !hasMongoDirectUri && !hasMongoBaseUrl) {
    missingEnvVars.push("MONGODB_URI or MONGODB_DIRECT_URI or MONGODB_URL");
}

if (!hasMongoUri && hasMongoBaseUrl && !hasDbName) {
    missingEnvVars.push("DB_NAME");
}

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
}

connectdb()
.then(()=>{
    server = app.listen(port,()=>{
        console.log(`Server is running on port ${port}`);
    })
})

.catch((err)=>{
    console.error("Failed to connect to the database", err);
    process.exit(1);
})

const gracefulShutdown = async (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    if (server) {
        server.close(async () => {
            try {
                await mongoose.connection.close(false);
                console.log('MongoDB connection closed.');
                process.exit(0);
            } catch (error) {
                console.error('Error during MongoDB shutdown:', error);
                process.exit(1);
            }
        });
    } else {
        process.exit(0);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));