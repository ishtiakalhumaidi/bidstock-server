import type { Request, Response } from "express";
import { authService } from "./auth.service";

const signUpUser = async (req: Request, res: Response) => {
  try {
    const result = await authService.signUpUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: { user_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const signinUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.signinUser(email, password);
    res.status(200).json({
      success: true,
      message: "user signed in successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const authController = {
    signinUser,
    signUpUser,
}