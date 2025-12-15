import type { Request, Response } from "express";
import { bidsService } from "./bids.service";

const addBid = async (req: Request, res: Response) => {
  try {
    const result = await bidsService.addBid(req.body);

    return res.status(201).json({
      success: true,
      message: "bid added successfully",
      data: { bid_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getBids = async (req: Request, res: Response) => {
  try {
    const result = await bidsService.getBids();

    return res.status(200).json({
      success: true,
      message: "bids retrieved successfully",
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

const getSingleBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;

    const result = await bidsService.getSingleBid(
      bid_id as string
    );

    return res.status(200).json({
      success: true,
      message: "bid retrieved successfully",
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

const updateBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;

    await bidsService.updateBid(
      req.body,
      bid_id as string
    );

    return res.status(200).json({
      success: true,
      message: "bid data updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;

    await bidsService.deleteBid(
      bid_id as string
    );

    return res.status(200).json({
      success: true,
      message: "bid deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const bidsController = {
  addBid,
  getBids,
  getSingleBid,
  updateBid,
  deleteBid,
};
