import type { Request, Response } from "express";
import { rentService } from "./rent.service";
import { pool } from "../../config/db";

const addRent = async (req: Request, res: Response) => {
  try {
    const result = await rentService.addRent(req.body);

    return res.status(201).json({
      success: true,
      message: "rent added successfully",
      data: { rent_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRents = async (req: Request, res: Response) => {
  try {
    const result = await rentService.getRents();

    return res.status(200).json({
      success: true,
      message: "rents retrieved successfully",
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

const getSingleRent = async (req: Request, res: Response) => {
  try {
    const { rent_id } = req.params;

    const result = await rentService.getSingleRent(rent_id as string);

    return res.status(200).json({
      success: true,
      message: "rent retrieved successfully",
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


const getMyRents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const seller_id = req.user.user_id;
    const result = await rentService.getMyRents(seller_id as string);

    return res.status(200).json({
      success: true,
      message: "my rents retrieved successfully",
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


const getWarehouseRents = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Verify the user owns this warehouse
    if (req.user.role === "warehouse_owner") {
      const [warehouseCheck] = await pool.query(
        `SELECT warehouse_id FROM warehouses WHERE warehouse_id = ? AND owner_id = ?`,
        [warehouse_id, req.user.user_id]
      );

      if ((warehouseCheck as any[]).length === 0) {
        return res.status(403).json({
          success: false,
          message: "You don't own this warehouse",
        });
      }
    }

    const result = await rentService.getWarehouseRents(warehouse_id as string);

    return res.status(200).json({
      success: true,
      message: "warehouse rents retrieved successfully",
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

const updateRent = async (req: Request, res: Response) => {
  try {
    const { rent_id } = req.params;

    await rentService.updateRent(req.body, rent_id as string);

    return res.status(200).json({
      success: true,
      message: "rent updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteRent = async (req: Request, res: Response) => {
  try {
    const { rent_id } = req.params;

    await rentService.deleteRent(rent_id as string);

    return res.status(200).json({
      success: true,
      message: "rent deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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