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
    console.error("Signup error:", error.message);

    // Return proper status codes
    if (error.message === "Email already registered") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("Missing required fields") || error.message.includes("Invalid role")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user. Please try again.",
    });
  }
};

const signinUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await authService.signinUser(email, password);

    return res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Signin error:", error.message);

    // Auth failures = 401, not 500
    const authErrors = [
      "Invalid email or password",
      "Account suspended",
      "Account is inactive",
    ];
    if (authErrors.some((msg) => error.message.includes(msg))) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

export const authController = {
  signinUser,
  signUpUser,
};