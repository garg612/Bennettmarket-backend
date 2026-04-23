import { Router } from "express"
import rateLimit from "express-rate-limit"
import { verifyJWT } from "../middlewares/auth.middlewares.js"
import { validateBody } from "../middlewares/validate.middlewares.js"
import {
    changePasswordSchema,
    loginUserSchema,
    verifyStudentOtpSchema,
    refreshTokenSchema,
    registerUserSchema
} from "../validations/user.validation.js"

import {
    registerUser,
    loginUser,
    logoutUser,
    getprofile,
    changepassword,
    refreshAccessToken,
    submitStudentVerification,
    verifyStudentVerificationOtp,
} from "../controllers/user.controllers.js"

const router=Router();

const studentOtpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.STUDENT_OTP_REQUEST_RATE_LIMIT_MAX || 8),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        statusCode: 429,
        success: false,
        message: "Too many OTP requests. Please try again later."
    }
});

const studentOtpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.STUDENT_OTP_VERIFY_RATE_LIMIT_MAX || 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        statusCode: 429,
        success: false,
        message: "Too many OTP verification attempts. Please try again later."
    }
});

router.route("/login").post(validateBody(loginUserSchema), loginUser)
router.route("/refresh_token").post(validateBody(refreshTokenSchema), refreshAccessToken)
router.route("/register").post(validateBody(registerUserSchema), registerUser)
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/u").get(verifyJWT,getprofile)
router.route("/profile").get(verifyJWT,getprofile)
router.route("/change_password").post(verifyJWT, validateBody(changePasswordSchema), changepassword)
router.route("/verify_student").post(verifyJWT, studentOtpRequestLimiter, submitStudentVerification)
router.route("/verify_student/otp").post(verifyJWT, studentOtpVerifyLimiter, validateBody(verifyStudentOtpSchema), verifyStudentVerificationOtp)


export default router;