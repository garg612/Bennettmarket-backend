import { Router } from "express";
import passport from "passport";
import {
    finalizeMicrosoftLogin,
    microsoftAuthFailure,
    microsoftAuthUnavailable
} from "../controllers/microsoftAuth.controllers.js";
import { isMicrosoftOAuthConfigured } from "../config/passport.js";

const router = Router();

const ensureMicrosoftConfigured = (req, res, next) => {
    if (!isMicrosoftOAuthConfigured()) {
        return microsoftAuthUnavailable(req, res);
    }

    return next();
};

router.get(
    "/auth/microsoft",
    ensureMicrosoftConfigured,
    passport.authenticate("microsoft", {
        session: false,
        prompt: "login"
    })
);

router.get(
    "/auth/microsoft/callback",
    ensureMicrosoftConfigured,
    (req, res, next) => {
        passport.authenticate("microsoft", { session: false }, (error, user) => {
            if (error || !user) {
                return microsoftAuthFailure(req, res);
            }

            req.user = user;
            return finalizeMicrosoftLogin(req, res, next);
        })(req, res, next);
    }
);

router.get("/auth/microsoft/failure", microsoftAuthFailure);

export default router;
