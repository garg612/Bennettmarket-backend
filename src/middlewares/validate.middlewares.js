import { z } from "zod";
import { Apierror } from "../utils/Apierror.js";

const formatZodError = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));

const replaceRequestSource = (req, source, parsed) => {
  const target = req[source];

  // In newer Express versions req.query/req.params can be getter-only, so mutate in place.
  if (target && typeof target === "object" && !Array.isArray(target)) {
    Object.keys(target).forEach((key) => {
      delete target[key];
    });
    Object.assign(target, parsed);
    return;
  }

  req[source] = parsed;
};

const validate = (schema, source) => async (req, _res, next) => {
  try {
    const parsed = await schema.parseAsync(req[source]);
    replaceRequestSource(req, source, parsed);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new Apierror(400, "Validation failed", formatZodError(error)));
    }

    return next(error);
  }
};

export const validateBody = (schema) => validate(schema, "body");
export const validateParams = (schema) => validate(schema, "params");
export const validateQuery = (schema) => validate(schema, "query");