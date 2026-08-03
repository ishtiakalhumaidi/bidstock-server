// rent.controller.ts
import type { Request, Response } from "express";
import { rentService } from "./rent.service";
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

const addRent = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const result = await rentService.addRent(
      req.body,
      req.user.user_id as number,
    );
    return res.status(201).json({
      success: true,
      message: "Rent created successfully",
      data: { rent_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to create rent");
  }
};

const getRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, status, warehouse_id } = req.query;
    const result = await rentService.getRents(req.user.role as string, {
      page: page as string,
      limit: limit as string,
      status: status as "active" | "completed" | "cancelled",
      warehouse_id: warehouse_id as string,
    });
    return res.status(200).json({
      success: true,
      message: "Rents retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve rents");
  }
};

const getSingleRent = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { rent_id } = req.params;
    const result = await rentService.getSingleRent(
      rent_id as string,
      req.user.user_id as number,
      req.user.role as string,
    );
    return res.status(200).json({
      success: true,
      message: "Rent retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve rent");
  }
};

const getMyRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, status, warehouse_id } = req.query;
    const result = await rentService.getMyRents(String(req.user.user_id), {
      page: page as string,
      limit: limit as string,
      status: status as "active" | "completed" | "cancelled",
      warehouse_id: warehouse_id as string,
    });
    return res.status(200).json({
      success: true,
      message: "My rents retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve rents");
  }
};

const getWarehouseRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { warehouse_id } = req.params;
    const { page, limit, status } = req.query;
    const result = await rentService.getWarehouseRents(
      warehouse_id as string,
      req.user.user_id as number,
      req.user.role as string,
      {
        page: page as string,
        limit: limit as string,
        status: status as "active" | "completed" | "cancelled",
      }
    );
    return res.status(200).json({
      success: true,
      message: "Warehouse rents retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve rents");
  }
};

const updateRent = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { rent_id } = req.params;
    await rentService.updateRent(
      req.body,
      rent_id as string,
      req.user.user_id as number,
      req.user.role as string,
    );
    return res.status(200).json({
      success: true,
      message: "Rent updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update rent");
  }
};

const deleteRent = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { rent_id } = req.params;
    await rentService.deleteRent(
      rent_id as string,
      req.user.user_id as number,
      req.user.role as string,
    );
    return res.status(200).json({
      success: true,
      message: "Rent deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete rent");
  }
};

export const rentController = {
  addRent,
  getRents,
  getSingleRent,
  getMyRents,
  getWarehouseRents,
  updateRent,
  deleteRent,
};