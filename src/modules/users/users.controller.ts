import type { Request, Response } from "express";
import { userService } from "./users.service";
import type { JwtPayload } from "jsonwebtoken";

const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await userService.getUsers();
    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getSingleUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized: no user info" });
    }

    const { user_id: id, role } = req.user as JwtPayload;


    if (user_id != id && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "forbidden: you have no access to this",
      });
    }

    const result = await userService.getSingleUser(user_id as string);

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getDashboardStats = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { user_id, role } = req.user as JwtPayload;
    
    const result = await userService.getDashboardStats(user_id, role);

    return res.status(200).json({
      success: true,
      message: "Dashboard stats retrieved",
      data: result,
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized: no user info" });
    }

    const { user_id: id, role } = req.user as JwtPayload;

    // FIX: Use != instead of !== here as well
    if (user_id != id && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "forbidden: you cannot update this user",
      });
    }

    const payload = { ...req.body };
    if (role !== "admin") {
      delete payload.role;
      delete payload.status;
    }

    const result = await userService.updateUser(payload, user_id as string);

    return res.status(200).json({
      success: true,
      message: "User data updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const result = await userService.deleteUser(user_id as string);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: null,
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const userController = {
  getUsers,
  getSingleUser,
  updateUser,
  getDashboardStats,
  deleteUser,
};