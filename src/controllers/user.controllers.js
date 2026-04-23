import { Apiresponse } from "../utils/apiresponse.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { Apierror } from "../utils/Apierror.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
};

const OTP_TTL_MINUTES = Number(process.env.STUDENT_OTP_EXPIRY_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.STUDENT_OTP_RESEND_COOLDOWN_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.STUDENT_OTP_MAX_ATTEMPTS || 5);
const OTP_LOCK_MINUTES = Number(process.env.STUDENT_OTP_LOCK_MINUTES || 15);

const getOtpSecret = () => {
    const secret = process.env.STUDENT_OTP_SECRET?.trim();

    if (!secret) {
        throw new Apierror(500, "STUDENT_OTP_SECRET is not configured");
    }

    return secret;
};

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const hashOtp = (otp) =>
    crypto
        .createHmac("sha256", getOtpSecret())
        .update(String(otp))
        .digest("hex");

const isOtpMatch = (providedOtp, storedHash) => {
    const providedHash = hashOtp(providedOtp);
    const providedBuffer = Buffer.from(providedHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (providedBuffer.length !== storedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuffer, storedBuffer);
};

const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
        throw new Apierror(500, "RESEND_API_KEY is not configured")
    }

    return new Resend(apiKey);
};

const sendStudentVerificationOtp = async (email, otp) => {
    const fromEmail =
        process.env.RESEND_FROM?.trim();

    if (!fromEmail) {
        throw new Apierror(500, "RESEND_FROM is not configured")
    }

    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: "CampusCart Student Verification OTP",
        text: `Your OTP for student verification is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
        html: `<p>Your OTP for student verification is <b>${otp}</b>.</p><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>`
    });

    if (error) {
        console.error("Resend OTP send error:", {
            to: email,
            from: fromEmail,
            statusCode: error.statusCode,
            message: error.message,
            name: error.name
        });
        throw new Apierror(502, `Failed to send verification OTP email: ${error.message}`)
    }

    return data?.id || null;
};

const generateAccessAndRefreshToken =async (userId) =>{
    try {
        const user=await User.findById(userId)
        if(!user){
            throw new Apierror(404,"user not found")
        }
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
    
        user.refreshtoken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
        
    } catch (error) {
        throw new Apierror(500,"failed to generate access and refresh token")
    }
}

export const registerUser=asyncHandler(async(req,res)=>{
    const {name,email,password}=req.body
    const existingUser=await User.findOne({
        email:email.toLowerCase()
    })
    if(existingUser){
        throw new Apierror(409,"user with email already exists")
    }
    const user=await User.create({
        name,
        email:email.toLowerCase(),
        password
    })
   const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const createdUser = await User.findById(user._id).select("-password -refreshtoken");

    if (!createdUser) {
        throw new Apierror(500, "Something went wrong while fetching created user");
    }
    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new Apiresponse(
                201,
                { user: createdUser, accessToken, refreshToken },
                "User registered successfully"
            )
        );
})

export const loginUser=asyncHandler(async(req,res)=>{
    const {email,password}=req.body;
    const user=await User.findOne({email:email.toLowerCase()})
    if(!user){
        throw new Apierror(404,"user not found")
    };
    const isPasswordValid=await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new Apierror(401,"invalid credentials")
    };

    const {accessToken,refreshToken} =await
    generateAccessAndRefreshToken(user._id);

    const loggedInUser= await User.findById(user._id)
    .select("-password -refreshtoken")

    if(!loggedInUser){
        throw new Apierror(401,"user not login")
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken,cookieOptions)
    .cookie("refreshToken",refreshToken,cookieOptions )
    .json(new Apiresponse(200,
        {user:loggedInUser,accessToken,refreshToken},
        "User logged in successfully"))
})

export const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate( 
        req.user._id,{
            $set:{refreshtoken:undefined}},
            {new: true}
        )
    return res.status(200)
    .clearCookie("accessToken",cookieOptions)
    .clearCookie("refreshToken",cookieOptions)
    .json(new Apiresponse(200,{},"User logged out"))
})


export const refreshAccessToken= asyncHandler(async(req,res)=>
    {
        const incommingRefreshToken=req.cookies.refreshToken//used for web 
        || req.body.refreshToken //this used for mobile app

        if(!incommingRefreshToken){
            throw new Apierror(401,"Refresh token is required")
        }
        try {
            const decodedToken=jwt.verify(
                incommingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET,
            )
            const user=await User.findById(decodedToken?._id)

            if(!user){
                throw new Apierror(401,"Invalid refresh token")
            }

            if(incommingRefreshToken !== user.refreshtoken){
                throw new Apierror(403,"invalid refresh token")
            }

            const {accessToken,refreshToken: newRefreshToken}=
            await generateAccessAndRefreshToken(user._id)

            return res
            .status(200)
            .cookie("accessToken",accessToken,cookieOptions)
            .cookie("refreshToken",newRefreshToken,cookieOptions)
            .json(new Apiresponse(200,{accessToken,refreshToken: newRefreshToken},"access token generated"))
        } catch (error) {
            if (error instanceof Apierror) {
                throw error;
            }
            throw new Apierror(401,"invalid refresh token")
        }
})

export const changepassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body
    const user=await User.findById(req.user._id);
    if(!user){
        throw new Apierror(404,"user not found");
    }
    const isOldPasswordValid=await user.isPasswordCorrect(oldPassword)
    if(!isOldPasswordValid){
        throw new Apierror(401,"invalid old password")
    }
    user.password=newPassword
    await user.save()
    return res.status(200).json(new Apiresponse(200,{},"password changed successfully"))
})

export const getprofile=asyncHandler(async(req,res)=>{
    return res.status(200).json(new Apiresponse(200,{user:req.user},"user profile fetched successfully"))
})

export const submitStudentVerification = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
        throw new Apierror(401, "Unauthorized")
    }

    const user = await User.findById(userId).select("email studentVerification");

    if (!user) {
        throw new Apierror(404, "user not found")
    }

    if (!user.email || !String(user.email).includes("@")) {
        throw new Apierror(400, "A valid email is required to request verification OTP")
    }

    if (user.studentVerification?.status === "verified") {
        return res
            .status(200)
            .json(new Apiresponse(200, {}, "Student is already verified"));
    }

    const now = Date.now();
    const lockUntilMs = user.studentVerification?.otpLockedUntil
        ? new Date(user.studentVerification.otpLockedUntil).getTime()
        : 0;

    if (lockUntilMs > now) {
        const retryAfterSeconds = Math.ceil((lockUntilMs - now) / 1000);
        throw new Apierror(429, `Too many invalid attempts. Try again in ${retryAfterSeconds} seconds`)
    }

    const lastSentAtMs = user.studentVerification?.otpSentAt
        ? new Date(user.studentVerification.otpSentAt).getTime()
        : 0;
    const resendAllowedAt = lastSentAtMs + OTP_RESEND_COOLDOWN_SECONDS * 1000;

    if (lastSentAtMs && resendAllowedAt > now) {
        const retryAfterSeconds = Math.ceil((resendAllowedAt - now) / 1000);
        throw new Apierror(429, `Please wait ${retryAfterSeconds} seconds before requesting a new OTP`)
    }

    const otp = generateOtp();
    const otpCodeHash = hashOtp(otp);
    const otpSentAt = new Date(now);
    const otpExpiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000);

    const deliveryId = await sendStudentVerificationOtp(user.email, otp);

    user.studentVerification = {
        ...user.studentVerification,
        otpCodeHash,
        otpSentAt,
        otpExpiresAt,
        otpAttemptCount: 0,
        otpLockedUntil: null
    };

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new Apiresponse(
            200,
            { otpExpiresAt, deliveryId },
            "OTP sent to your registered email for student verification"
        )
    );
});

export const verifyStudentVerificationOtp = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;
    const { otp } = req.body;

    if (!userId) {
        throw new Apierror(401, "Unauthorized")
    }

    const user = await User.findById(userId).select("studentVerification");

    if (!user) {
        throw new Apierror(404, "user not found")
    }

    if (user.studentVerification?.status === "verified") {
        return res.status(200).json(new Apiresponse(200, {}, "Student is already verified"));
    }

    const now = Date.now();
    const lockUntilMs = user.studentVerification?.otpLockedUntil
        ? new Date(user.studentVerification.otpLockedUntil).getTime()
        : 0;

    if (lockUntilMs > now) {
        const retryAfterSeconds = Math.ceil((lockUntilMs - now) / 1000);
        throw new Apierror(429, `Too many invalid attempts. Try again in ${retryAfterSeconds} seconds`)
    }

    const currentHash = user.studentVerification?.otpCodeHash;
    const expiresAt = user.studentVerification?.otpExpiresAt;

    if (!currentHash || !expiresAt) {
        throw new Apierror(400, "Please request verification OTP first")
    }

    if (new Date(expiresAt).getTime() < now) {
        user.studentVerification = {
            ...user.studentVerification,
            otpCodeHash: "",
            otpExpiresAt: null,
            otpSentAt: null,
            otpAttemptCount: 0
        };
        await user.save({ validateBeforeSave: false });
        throw new Apierror(400, "OTP has expired. Please request a new OTP")
    }

    if (!isOtpMatch(otp, currentHash)) {
        const nextAttemptCount = Number(user.studentVerification?.otpAttemptCount || 0) + 1;
        const isLocked = nextAttemptCount >= OTP_MAX_ATTEMPTS;

        user.studentVerification = {
            ...user.studentVerification,
            otpAttemptCount: isLocked ? 0 : nextAttemptCount,
            otpLockedUntil: isLocked ? new Date(now + OTP_LOCK_MINUTES * 60 * 1000) : null,
            otpCodeHash: isLocked ? "" : user.studentVerification?.otpCodeHash,
            otpExpiresAt: isLocked ? null : user.studentVerification?.otpExpiresAt,
            otpSentAt: isLocked ? null : user.studentVerification?.otpSentAt
        };
        await user.save({ validateBeforeSave: false });

        if (isLocked) {
            throw new Apierror(429, "Too many invalid OTP attempts. Please request a new OTP later")
        }

        throw new Apierror(400, "Invalid OTP")
    }

    user.studentVerification = {
        ...user.studentVerification,
        status: "verified",
        submittedAt: new Date(),
        otpCodeHash: "",
        otpExpiresAt: null,
        otpSentAt: null,
        otpAttemptCount: 0,
        otpLockedUntil: null,
        idCardFront: "",
        idCardBack: "",
        reportCount: 0,
        reportedBy: []
    };

    await user.save({ validateBeforeSave: false });

    const updatedUser = await User.findById(userId).select("-password -refreshtoken");

    return res
        .status(200)
        .json(new Apiresponse(200, { user: updatedUser }, "Student verification successful"));
});