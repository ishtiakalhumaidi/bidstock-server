// utils/AppError.ts
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export const BadRequest = (msg: string) => new AppError(msg, 400);
export const Unauthorized = (msg: string) => new AppError(msg, 401);
export const Forbidden = (msg: string) => new AppError(msg, 403);
export const NotFound = (msg: string) => new AppError(msg, 404);
export const Conflict = (msg: string) => new AppError(msg, 409);