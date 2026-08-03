// bids.controller.ts
import type { Request, Response } from "express";
import { bidsService } from "./bids.service";
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

const addBid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const result = await bidsService.addBid(req.body, req.user.user_id as number);
    return res.status(201).json({
      success: true,
      message: "Auction created successfully",
      data: { bid_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to create auction");
  }
};

const getBids = async (req: Request, res: Response) => {
  try {
    const { page, limit, category, min_price, max_price, seller_id, sort } = req.query;
    const result = await bidsService.getBids({
      page: page as string,
      limit: limit as string,
      category: category as string,
      min_price: min_price as string,
      max_price: max_price as string,
      seller_id: seller_id as string,
      sort: sort as "ending_soon" | "newest" | "highest_bid",
    });
    return res.status(200).json({
      success: true,
      message: "Auctions retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve auctions");
  }
};

const getSingleBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;
    const result = await bidsService.getSingleBid(bid_id as string);
    if (!result) {
      return res.status(404).json({ success: false, message: "Auction not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Auction retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve auction");
  }
};

const getMyBids = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit } = req.query;
    const result = await bidsService.getMyBids(
      String(req.user.user_id),
      page as string,
      limit as string
    );
    return res.status(200).json({
      success: true,
      message: "My auctions retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve my auctions");
  }
};

const updateBid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { bid_id } = req.params;
    await bidsService.updateBid(req.body, bid_id as string, req.user.user_id as number);
    return res.status(200).json({
      success: true,
      message: "Auction updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update auction");
  }
};

const deleteBid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { bid_id } = req.params;
    await bidsService.deleteBid(bid_id as string, req.user.user_id as number);
    return res.status(200).json({
      success: true,
      message: "Auction deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete auction");
  }
};

export const bidsController = {
  addBid,
  getBids,
  getSingleBid,
  getMyBids,
  updateBid,
  deleteBid,
};