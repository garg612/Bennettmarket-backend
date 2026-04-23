import mongoose from "mongoose";
import {DB_NAME } from "./constant.js";

const connectdb=async()=>{
    const fullUri = process.env.MONGODB_URI?.trim();
    const directUri = process.env.MONGODB_DIRECT_URI?.trim();
    const baseUrl = process.env.MONGODB_URL?.trim();
    const dbName = process.env.DB_NAME?.trim() || DB_NAME;
    const baseModeUri = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/${dbName}` : "";

    const candidates = [fullUri, directUri, baseModeUri].filter(Boolean);

    if (candidates.length === 0) {
        throw new Error("No MongoDB connection URI configured.");
    }

    let lastError;

    for (const mongoUri of candidates) {
        try {
            const connectionInstance = await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000
            });
            console.log(`MongoDB connected successfully: ${connectionInstance.connection.host}`);
            return;
        } catch (error) {
            lastError = error;
            console.error("MongoDB connection attempt failed for configured URI.");
        }
    }

    console.error("Error connecting to MongoDB:", lastError);
    process.exit(1);
}
export default connectdb;