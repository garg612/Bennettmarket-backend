import { User } from "../models/user.models.js";
import { Apierror } from "../utils/Apierror.js";
import { Apiresponse } from "../utils/apiresponse.js";
import { getAuthCookieOptions } from "../utils/authCookie.js";

const cookieOptions = getAuthCookieOptions();

const getFrontendBaseUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";
const getSuccessRedirectUrl = () =>
    process.env.MICROSOFT_AUTH_SUCCESS_REDIRECT || `${getFrontendBaseUrl()}/`;
const getFailureRedirectUrl = () =>
    process.env.MICROSOFT_AUTH_FAILURE_REDIRECT || `${getFrontendBaseUrl()}/?authError=microsoft_oauth_failed`;

const generateAccessAndRefreshToken = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Apierror(404, "user not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshtoken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};

export const finalizeMicrosoftLogin = async (req, res, next) => {
    try {
        const authUserId = req.user?._id;

        if (!authUserId) {
            throw new Apierror(401, "Microsoft authentication failed");
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(authUserId);

        const loggedInUser = await User.findById(authUserId).select("-password -refreshtoken");

        if (!loggedInUser) {
            throw new Apierror(404, "user not found after Microsoft authentication");
        }

        const redirectUrl = `${getSuccessRedirectUrl()}?token=${accessToken}`;

        res
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions);

        return res.redirect(redirectUrl);

    } catch (error) {
        next(error);
    }
};

export const microsoftAuthFailure = (req, res) => {
    return res.redirect(getFailureRedirectUrl());
};

export const microsoftAuthUnavailable = (_req, res) => {
    return res.status(503).json(new Apiresponse(503, {}, "Microsoft OAuth is not configured on server"));
};
