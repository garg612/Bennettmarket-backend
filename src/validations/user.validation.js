import { z } from "zod";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters long");

export const registerUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  email: z.string().trim().email("Please provide a valid email address"),
  password: passwordSchema
});

export const loginUserSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required")
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().optional()
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: passwordSchema
});

export const verifyStudentOtpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be a 6 digit code")
});