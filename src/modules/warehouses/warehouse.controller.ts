import type { Request, Response } from "express";
import { warehouseService } from "./warehouse.service";

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
    console.error("Add warehouse error:", error.message);

    if (error.message.includes("required") || error.message.includes("must be")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to add warehouse" });
  }
};

const getWarehouses = async (req: Request, res: Response) => {
  try {
    const result = await warehouseService.getWarehouses();

    return res.status(200).json({
      success: true,
      message: "Warehouses retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get warehouses error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve warehouses" });
  }
};

const getMyWarehouses = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await warehouseService.getMyWarehouses(
      String(req.user.user_id)
    );

    return res.status(200).json({
      success: true,
      message: "My warehouses retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get my warehouses error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve warehouses" });
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
    console.error("Get single warehouse error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve warehouse" });
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
    console.error("Update warehouse error:", error.message);

    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("required") || error.message.includes("must be") || error.message.includes("cannot")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to update warehouse" });
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
    console.error("Delete warehouse error:", error.message);

    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("Cannot delete")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to delete warehouse" });
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