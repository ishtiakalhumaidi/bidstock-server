// inventory.controller.ts
import type { Request, Response } from "express";
import { inventoryService } from "./inventory.service";
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

const addInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const result = await inventoryService.addInventory(req.body, req.user.user_id as number);
    return res.status(201).json({
      success: true,
      message: result.updated ? "Inventory stock updated" : "Inventory added successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to add inventory");
  }
};

const getInventories = async (req: Request, res: Response) => {
  try {
    const { page, limit, warehouse_id, product_id, low_stock } = req.query;
    const result = await inventoryService.getInventories({
      page: page as string,
      limit: limit as string,
      warehouse_id: warehouse_id as string,
      product_id: product_id as string,
      low_stock: low_stock as string,
    });
    return res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve inventory");
  }
};

const getMyInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, warehouse_id, product_id, low_stock } = req.query;
    const result = await inventoryService.getMyInventory(String(req.user.user_id), {
      page: page as string,
      limit: limit as string,
      warehouse_id: warehouse_id as string,
      product_id: product_id as string,
      low_stock: low_stock as string,
    });
    return res.status(200).json({
      success: true,
      message: "My inventory retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve my inventory");
  }
};

const getWarehouseOwnerInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, warehouse_id, product_id, search, min_quantity } = req.query;
    const result = await inventoryService.getWarehouseOwnerInventory(String(req.user.user_id), {
      page: page as string,
      limit: limit as string,
      warehouse_id: warehouse_id as string,
      product_id: product_id as string,
      search: search as string,
      min_quantity: min_quantity as string,
    });
    return res.status(200).json({
      success: true,
      message: "Warehouse inventory retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve warehouse inventory");
  }
};

const getSingleInventory = async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id } = req.params;
    const result = await inventoryService.getSingleInventory(
      product_id as string,
      warehouse_id as string
    );
    if (!result) {
      return res.status(404).json({ success: false, message: "Inventory record not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve inventory record");
  }
};

const updateInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { product_id, warehouse_id } = req.params;
    await inventoryService.updateInventory(
      req.body,
      product_id as string,
      warehouse_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update inventory");
  }
};

const deleteInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { product_id, warehouse_id } = req.params;
    await inventoryService.deleteInventory(
      product_id as string,
      warehouse_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Inventory deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete inventory");
  }
};

export const inventoryController = {
  addInventory,
  getInventories,
  getMyInventory,
  getWarehouseOwnerInventory,
  getSingleInventory,
  updateInventory,
  deleteInventory,
};