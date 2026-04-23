import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

// Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDNARY_CLOUD_NAME, 
        api_key: process.env.CLOUDNARY_API_KEY, 
        api_secret: process.env.CLOUDNARY_API_SECRET
    });
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(
            localFilePath,
            { resource_type: "auto" }
        );
        fs.unlinkSync(localFilePath);
        return { url: response.secure_url || response.url, public_id: response.public_id }; // Return both
    } catch (error) {
        if (!localFilePath || !fs.existsSync(localFilePath)) {
            return null;
        }

        // Fallback to local static file URL so listing creation can still succeed.
        const fileName = path.basename(localFilePath);
        const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
        return {
            url: `${publicBaseUrl}/temp/${fileName}`,
            public_id: null
        };
    }
};

const deleteFromCloudinary = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };