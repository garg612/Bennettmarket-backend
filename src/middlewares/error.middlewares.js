//we can copy paste it to other projects as well
//this file is used to handle errors in the application
import mongoose from "mongoose"
import multer from "multer";
import { z } from "zod";

import { Apierror } from "../utils/Apierror.js";

const errorhandler=(err,req,res,next)=>{
    const isExpectedAuthError = err instanceof Apierror && [401, 403].includes(err.statusCode);

    if (process.env.NODE_ENV !== "production" && !isExpectedAuthError) {
        console.error("Error caught in errorhandler:", err);
    }

    let error =err;

    if (error instanceof multer.MulterError) {
        error = new Apierror(400, error.message);
    } else if (error instanceof z.ZodError) {
        error = new Apierror(
            400,
            "Validation failed",
            error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message
            }))
        );
    }

    if(!(error instanceof Apierror)){
       const statusCode=error.statusCode || (error instanceof mongoose.Error ? 400:500)
       const message=error.message|| "Something went wrong"
       error=new Apierror(statusCode,message,error?.errors ||[],err.stack)
    }

    const response={
        statusCode: error.statusCode,
        message: error.message,
        data: error.data,
        success: error.success,
        errors: error.errors,
        ...(process.env.NODE_ENV==="development" ? {stack:error.stack}:{})
    }

    return res.status(error.statusCode).json(response)
}

export {errorhandler}