import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters long"),
  description: z.string().trim().min(10, "Description must be at least 10 characters long"),
  price: z.coerce.number().positive("Price must be a positive number"),
  category: z.string().trim().min(2, "Category is required")
});

const optionalTrimmedString = (minLength, message) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().trim().min(minLength, message).optional()
  );

export const updateProductSchema = z.object({
  name: optionalTrimmedString(2, "Product name must be at least 2 characters long"),
  description: optionalTrimmedString(10, "Description must be at least 10 characters long"),
  category: optionalTrimmedString(2, "Category is required"),
  condition: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["New", "Like New", "Good", "Fair", "Used"]).optional()
  ),
  price: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === "string" && value.trim() === "") return undefined;
      return value;
    },
    z.coerce.number().positive("Price must be a positive number").optional()
  )
});

export const buyProductParamsSchema = z.object({
  id: objectIdSchema
});

export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});