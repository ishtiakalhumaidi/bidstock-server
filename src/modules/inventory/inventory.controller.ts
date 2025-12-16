import type { Request, Response } from "express";
import { inventoryService } from "./inventory.service";

const addInventory = async (req: Request, res: Response) => {
  try {
    const user = req.user
    if (!user){
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    
    const result = await inventoryService.addInventory(req.body);

    return res.status(201).json({
      success: true,
      message: "inventory added successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getInventories = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getInventories();

    return res.status(200).json({
      success: true,
      message: "inventories retrieved successfully",
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
const getMyInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await inventoryService.getMyInventory(req.user.user_id as string);

    return res.status(200).json({
      success: true,
      message: "My inventory retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getSingleInventory = async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id } = req.params;

    const result = await inventoryService.getSingleInventory(
      product_id as string,
      warehouse_id as string
    );

    return res.status(200).json({
      success: true,
      message: "inventory retrieved successfully",
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

const updateInventory = async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: no user info",
      });
    }

    if (req.user.role === "seller") {
      await inventoryService.updateInventory(
        req.body,
        product_id as string,
        warehouse_id as string,
        req.user.user_id as string
      );
    } else {
      await inventoryService.updateInventory(
        req.body,
        product_id as string,
        warehouse_id as string
      );
    }

    return res.status(200).json({
      success: true,
      message: "inventory data updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteInventory = async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id } = req.params;

    await inventoryService.deleteInventory(
      product_id as string,
      warehouse_id as string
    );

    return res.status(200).json({
      success: true,
      message: "inventory deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const inventoryController = {
  addInventory,
  getInventories,
  getSingleInventory,
  getMyInventory,
  updateInventory,
  deleteInventory,
};