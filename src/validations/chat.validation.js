import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const startChatSchema = z.object({
  productId: objectIdSchema,
  participantId: objectIdSchema.optional()
});

export const chatParamsSchema = z.object({
  id: objectIdSchema
});

export const addMessageSchema = z.object({
  text: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message is too long")
});
