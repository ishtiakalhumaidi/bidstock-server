import type { NextFunction, Request, Response } from "express";
import Jwt, { type JwtPayload } from "jsonwebtoken";
import config from "../config";

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
      const decoded = Jwt.verify(
        token as string,
        config.jwt_secret as string
      ) as JwtPayload;

      req.user = decoded;

      // role checking
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: "forbidden: you don't have permission",
        });
      }

      next();
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: `unauthorized: ${error.message}`,
      });
    }
  };
};

export default auth;
