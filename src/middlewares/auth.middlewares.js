import jwt from 'jsonwebtoken';
import { User } from '../models/user.models.js';
import { Apierror } from '../utils/Apierror.js';
import { asyncHandler } from '../utils/asynchandler.js';

export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new Apierror(401, "Unauthorized");
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken._id)
      .select("-password -refreshtoken");

    if (!user) {
      throw new Apierror(403, "Forbidden");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new Apierror(401, "Invalid access token");
  }
});

export const optionalJWT = asyncHandler(async (req, _res, next) => {
  const token =
    req.cookies.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return next();
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken._id)
      .select("-password -refreshtoken");

    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid/expired token for optional auth routes.
  }

  return next();
});