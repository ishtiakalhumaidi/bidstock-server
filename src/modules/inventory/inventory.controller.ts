import type { Request, Response } from "express";
import { inventoryService } from "./inventory.service";

const addInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await inventoryService.addInventory(req.body, req.user.user_id as number);

    return res.status(201).json({
      success: true,
      message: result.updated ? "Inventory updated successfully" : "Inventory added successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Add inventory error:", error.message);

    if (error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("required") || error.message.includes("must be") || error.message.includes("Not enough")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found") || error.message.includes("inactive")) {
      return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to add inventory" });
  }
};

const getInventories = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getInventories();

    return res.status(200).json({
      success: true,
      message: "Inventories retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get inventories error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve inventories" });
  }
};

const getMyInventory = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await inventoryService.getMyInventory(String(req.user.user_id));

    return res.status(200).json({
      success: true,
      message: "My inventory retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get my inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve inventory" });
  }
};

const getSingleInventory = async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id } = req.params;

    const result = await inventoryService.getSingleInventory(product_id as string, warehouse_id as string);

    if (!result) {
      return res.status(404).json({ success: false, message: "Inventory not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get single inventory error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve inventory" });
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
    console.error("Update inventory error:", error.message);

    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("must be")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to update inventory" });
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
    console.error("Delete inventory error:", error.message);

    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("pending transactions")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to delete inventory" });
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