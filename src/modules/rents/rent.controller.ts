import type { Request, Response } from "express";
import { rentService } from "./rent.service";

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
    console.error("Add rent error:", error.message);

    if (
      error.message.includes("required") ||
      error.message.includes("must be") ||
      error.message.includes("cannot be")
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes("already rented") ||
      error.message.includes("maintenance")
    ) {
      return res.status(409).json({ success: false, message: error.message });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to create rent" });
  }
};

const getRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await rentService.getRents(req.user.role as string);

    return res.status(200).json({
      success: true,
      message: "Rents retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get rents error:", error.message);
    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve rents" });
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
    console.error("Get single rent error:", error.message);
    if (
      error.message.includes("Forbidden") ||
      error.message.includes("Unauthorized")
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve rent" });
  }
};

const getMyRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await rentService.getMyRents(String(req.user.user_id));

    return res.status(200).json({
      success: true,
      message: "My rents retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get my rents error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve rents" });
  }
};

const getWarehouseRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { warehouse_id } = req.params;
    const result = await rentService.getWarehouseRents(
      warehouse_id as string,
      req.user.user_id as number,
      req.user.role as string,
    );

    return res.status(200).json({
      success: true,
      message: "Warehouse rents retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get warehouse rents error:", error.message);
    if (
      error.message.includes("Forbidden") ||
      error.message.includes("Unauthorized")
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve rents" });
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
    console.error("Update rent error:", error.message);
    if (
      error.message.includes("Forbidden") ||
      error.message.includes("Unauthorized")
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes("conflict") ||
      error.message.includes("must be") ||
      error.message.includes("Cannot update")
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to update rent" });
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
    console.error("Delete rent error:", error.message);
    if (
      error.message.includes("Forbidden") ||
      error.message.includes("Unauthorized")
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message.includes("Cannot delete") ||
      error.message.includes("inventory")
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete rent" });
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
