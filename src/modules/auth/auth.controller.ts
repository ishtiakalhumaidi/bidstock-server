// auth.controller.ts
import type { Request, Response } from "express";
import { authService } from "./auth.service";
import { AppError } from "../../utils/AppError";

const handleError = (res: Response, error: any, fallbackMessage: string) => {
  console.error(fallbackMessage, error.message);
  if (error instanceof AppError) {
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const signUp = async (req: Request, res: Response) => {
  try {
    const result = await authService.signUpUser(req.body);
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { user_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to register user");
  }
};

const createAdmin = async (req: Request, res: Response) => {
  try {
    const result = await authService.createAdminUser(req.body);
    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: { user_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to create admin");
  }
};

const signIn = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.signinUser(email, password);
    return res.status(200).json({
      success: true,
      message: "Signed in successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Authentication failed");
  }
};

const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to refresh token");
  }
};

export const authController = {
  signUp,
  createAdmin,
  signIn,
  refreshToken,
};