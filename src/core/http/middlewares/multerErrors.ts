import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

/**
 * Normalizes Multer (file upload) errors to our error handler.
 *
 * - `LIMIT_FILE_SIZE` -> 413 Payload Too Large
 * - Other Multer limits -> 400 Bad Request
 * - Unsupported mime (custom errors that match) -> 415 Unsupported Media Type
 *
 * This middleware does not send the response itself; it sets `err.statusCode`
 * and forwards to the final error handler.
 */
export const multerErrors: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      (err as any).statusCode = 413;
    } else {
      (err as any).statusCode = 400;
    }
  } else if (err && /Unsupported mime/i.test(err.message || "")) {
    (err as any).statusCode = 415;
  }
  next(err);
};