export const getAuthCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
        process.env.AUTH_COOKIE_SAMESITE ||
        (process.env.NODE_ENV === "production" ? "none" : "strict"),
    path: "/"
});
