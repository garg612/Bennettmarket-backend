import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const reservationParamsSchema = z.object({
  id: objectIdSchema
});

export const reservationDecisionSchema = z.object({
  action: z.enum(["reserve", "cancel"])
});
