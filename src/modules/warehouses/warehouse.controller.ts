import type { Request, Response } from "express";
import { warehouseService } from "./warehouse.service";

const addWarehouse = async (req: Request, res: Response) => {
  try {
    const result = await warehouseService.addWarehouse(req.body);

    return res.status(201).json({
      success: true,
      message: "warehouse added successfully",
      data: { warehouse_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getWarehouses = async (req: Request, res: Response) => {
  try {
    const result = await warehouseService.getWarehouses();

    return res.status(200).json({
      success: true,
      message: "warehouses retrieved successfully",
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

const getSingleWarehouse = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.params;
    const result = await warehouseService.getSingleWarehouse(
      warehouse_id as string
    );

    return res.status(200).json({
      success: true,
      message: "warehouse retrieved successfully",
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

const updateWarehouse = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.params;
    const result = await warehouseService.updateWarehouse(
      req.body,
      warehouse_id as string
    );

    return res.status(200).json({
      success: true,
      message: "warehouse data updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const deleteWarehouse = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.params;
    const result = await warehouseService.deleteWarehouse(
      warehouse_id as string
    );

    return res.status(200).json({
      success: true,
      message: "warehouse deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const warehouseController = {
  addWarehouse,
  getWarehouses,
  getSingleWarehouse,
  updateWarehouse,
  deleteWarehouse
};
