import type { Request, Response } from "express";
import { userService } from "./users.service";

const createUser = async (req: Request, res: Response) => {
  try {
    const result = await userService.createUser(req.body);

    return res.status(201).json({
      success: true,
      message: "Users created successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getSingleUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const result = await userService.getSingleUser(user_id as string);

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const result = await userService.updateUser(req.body, user_id as string);

    return res.status(200).json({
      success: true,
      message: "User data updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const userController = {
  getUsers,
  getSingleUser,
  createUser,
  updateUser,
  deleteUser,
};
