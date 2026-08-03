// warehouse.controller.ts
import type { Request, Response } from "express";
import { warehouseService } from "./warehouse.service";
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

const addWarehouse = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const result = await warehouseService.addWarehouse(
      req.body,
      req.user.user_id as number
    );
    return res.status(201).json({
      success: true,
      message: "Warehouse added successfully",
      data: { warehouse_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to add warehouse");
  }
};

const getWarehouses = async (req: Request, res: Response) => {
  try {
    const { page, limit, status, location, min_price, max_price, min_capacity, search } = req.query;
    const result = await warehouseService.getWarehouses({
      page: page as string,
      limit: limit as string,
      status: status as string,
      location: location as string,
      min_price: min_price as string,
      max_price: max_price as string,
      min_capacity: min_capacity as string,
      search: search as string,
    });
    return res.status(200).json({
      success: true,
      message: "Warehouses retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve warehouses");
  }
};

const getMyWarehouses = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, status, search } = req.query;
    const result = await warehouseService.getMyWarehouses(
      String(req.user.user_id),
      {
        page: page as string,
        limit: limit as string,
        status: status as string,
        search: search as string,
      }
    );
    return res.status(200).json({
      success: true,
      message: "My warehouses retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve warehouses");
  }
};

const getSingleWarehouse = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.params;
    const result = await warehouseService.getSingleWarehouse(warehouse_id as string);
    if (!result) {
      return res.status(404).json({ success: false, message: "Warehouse not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Warehouse retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve warehouse");
  }
};

const updateWarehouse = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { warehouse_id } = req.params;
    await warehouseService.updateWarehouse(
      req.body,
      warehouse_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Warehouse updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update warehouse");
  }
};

const deleteWarehouse = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { warehouse_id } = req.params;
    await warehouseService.deleteWarehouse(
      warehouse_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Warehouse deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete warehouse");
  }
};

export const warehouseController = {
  addWarehouse,
  getWarehouses,
  getSingleWarehouse,
  updateWarehouse,
  getMyWarehouses,
  deleteWarehouse,
};