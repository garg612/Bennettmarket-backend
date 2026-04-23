import passport from "passport";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import crypto from "crypto";
import { User } from "../models/user.models.js";

const getOAuthProfile = (profile) => {
    const primaryEmail = profile?.emails?.[0]?.value || profile?._json?.preferred_username || "";
    const displayName =
        profile?.displayName ||
        [profile?.name?.givenName, profile?.name?.familyName].filter(Boolean).join(" ") ||
        "Microsoft User";

    return {
        microsoftId: profile?.id || "",
        email: String(primaryEmail).toLowerCase(),
        name: displayName.trim() || "Microsoft User"
    };
};

const createOAuthPassword = () => `oauth_${crypto.randomBytes(24).toString("hex")}`;

const getMicrosoftTenant = () => process.env.MICROSOFT_TENANT_ID?.trim();
const getPublicBaseUrl = () => process.env.PUBLIC_BASE_URL?.trim();
const getMicrosoftCallbackUrl = () =>
    process.env.MICROSOFT_CALLBACK_URL?.trim() ||
    (getPublicBaseUrl() ? `${getPublicBaseUrl().replace(/\/+$/, "")}/auth/microsoft/callback` : "");

const getMicrosoftAuthority = () => {
    const tenant = getMicrosoftTenant();

    if (!tenant) {
        return null;
    }

    return {
        authorizationURL: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        tokenURL: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
    };
};

export const isMicrosoftOAuthConfigured = () =>
    Boolean(
        process.env.MICROSOFT_CLIENT_ID &&
            process.env.MICROSOFT_CLIENT_SECRET &&
            getMicrosoftCallbackUrl() &&
            getMicrosoftTenant()
    );

export const configurePassport = () => {
    if (!isMicrosoftOAuthConfigured()) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("Microsoft OAuth is not configured. Missing Microsoft env variables.");
        }
        return;
    }

    passport.use(
        new MicrosoftStrategy(
            {
                ...getMicrosoftAuthority(),
                clientID: process.env.MICROSOFT_CLIENT_ID,
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
                callbackURL: getMicrosoftCallbackUrl(),
                scope: ["openid", "profile", "email", "User.Read"]
            },
            async (_accessToken, _refreshToken, profile, done) => {
                try {
                    const oauthProfile = getOAuthProfile(profile);

                    if (!oauthProfile.microsoftId || !oauthProfile.email) {
                        return done(new Error("Microsoft account did not return required profile fields"));
                    }

                    let user = await User.findOne({
                        $or: [{ email: oauthProfile.email }, { microsoftId: oauthProfile.microsoftId }]
                    });

                    if (!user) {
                        user = await User.create({
                            name: oauthProfile.name,
                            email: oauthProfile.email,
                            password: createOAuthPassword(),
                            microsoftId: oauthProfile.microsoftId
                        });
                    } else if (!user.microsoftId) {
                        user.microsoftId = oauthProfile.microsoftId;
                        if (!user.name && oauthProfile.name) {
                            user.name = oauthProfile.name;
                        }
                        await user.save({ validateBeforeSave: false });
                    }

                    return done(null, { _id: user._id });
                } catch (error) {
                    return done(error);
                }
            }
        )
    );
};

export default passport;
