// users.controller.ts
import type { Request, Response } from "express";
import { userService } from "./users.service";
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

const getUsers = async (req: Request, res: Response) => {
  try {
    const { page, limit, role, status, search } = req.query;
    const result = await userService.getUsers({
      page: page as string,
      limit: limit as string,
      role: role as "buyer" | "seller" | "warehouse_owner" | "admin",
      status: status as "active" | "inactive" | "suspended",
      search: search as string,
    });
    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve users");
  }
};

const getSingleUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { user_id } = req.params;
    const { user_id: id, role } = req.user;

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
    return handleError(res, error, "Failed to retrieve user");
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
    return handleError(res, error, "Failed to retrieve stats");
  }
};

const updateUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { user_id } = req.params;
    const { user_id: id, role } = req.user;
    const isAdmin = role === "admin";

    if (String(user_id) !== String(id) && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you cannot update this user",
      });
    }

    const payload = { ...req.body };
    if (payload.password && String(user_id) !== String(id)) {
      delete payload.password;
    }

    await userService.updateUser(payload, user_id as string, isAdmin);
    return res.status(200).json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update user");
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { user_id } = req.params;
    await userService.deleteUser(user_id as string);
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete user");
  }
};

export const userController = {
  getUsers,
  getSingleUser,
  updateUser,
  getDashboardStats,
  deleteUser,
};