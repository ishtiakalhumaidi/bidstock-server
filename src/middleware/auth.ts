import type { NextFunction, Request, Response } from "express";
import Jwt from "jsonwebtoken";
import config from "../config";
import type { CustomJwtPayload } from "../types/index";

const auth = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: "unauthorized: no token provided",
        });
      }

      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
          success: false,
          message: "unauthorized: invalid token format",
        });
      }

      const token = parts[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "unauthorized: token missing",
        });
      }

      const decoded = Jwt.verify(
        token,
        config.jwt_secret as string,
      ) as CustomJwtPayload;

      req.user = decoded;

      // Role checking with type safety
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: "forbidden: you don't have permission",
        });
      }

      return next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(401).json({
        success: false,
        message: `unauthorized: ${message}`,
      });
    }
  };
};

export default auth;
