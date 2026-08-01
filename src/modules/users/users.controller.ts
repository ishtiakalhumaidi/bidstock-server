import type { Request, Response } from "express";
import { userService } from "./users.service";

const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await userService.getUsers();

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get users error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve users" });
  }
};

const getSingleUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { user_id } = req.params;
    const { user_id: id, role } = req.user;

    // Strict equality with type conversion
    if (String(user_id) !== String(id) && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you have no access to this user",
      });
    }

    const result = await userService.getSingleUser(user_id as string);

    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get single user error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve user" });
  }
};

const getDashboardStats = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { user_id, role } = req.user;
    const result = await userService.getDashboardStats(String(user_id), role as string);

    return res.status(200).json({
      success: true,
      message: "Dashboard stats retrieved",
      data: result,
    });
  } catch (error: any) {
    console.error("Get dashboard stats error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve stats" });
  }
};

const updateUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { user_id } = req.params;
    const { user_id: id, role } = req.user;

    if (String(user_id) !== String(id) && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you cannot update this user",
      });
    }

    const payload = { ...req.body };

    // Non-admins cannot change role, status, or email to an existing one
    if (role !== "admin") {
      delete payload.role;
      delete payload.status;
    }

    // Only self can change password (not even admin should set plaintext passwords)
    if (payload.password && String(user_id) !== String(id)) {
      delete payload.password;
    }

    await userService.updateUser(payload, user_id as string);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error: any) {
    console.error("Update user error:", error.message);

    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("already in use") || error.message.includes("Invalid") || error.message.includes("must be")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to update user" });
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    await userService.deleteUser(user_id as string  );

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete user error:", error.message);

    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("Cannot delete")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to delete user" });
  }
};

export const userController = {
  getUsers,
  getSingleUser,
  updateUser,
  getDashboardStats,
  deleteUser,
};