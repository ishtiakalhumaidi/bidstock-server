import type { Request, Response } from "express";
import { bidsService } from "./bids.service";

// Helper for type-safe error handling without 'any'
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const addBid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await bidsService.addBid(req.body, req.user.user_id);

    return res.status(201).json({
      success: true,
      message: "Auction created successfully",
      data: { bid_id: result },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Add bid error:", message);

    if (message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message });
    }
    if (
      message.includes("required") ||
      message.includes("must be") ||
      message.includes("already has")
    ) {
      return res.status(400).json({ success: false, message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ success: false, message });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create auction",
    });
  }
};

const getBids = async (_req: Request, res: Response) => {
  try {
    const result = await bidsService.getBids();

    return res.status(200).json({
      success: true,
      message: "Auctions retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get bids error:", getErrorMessage(error));
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve auctions" });
  }
};

const getMyBids = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await bidsService.getMyBids(req.user.user_id);

    return res.status(200).json({
      success: true,
      message: "My auctions retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get my bids error:", getErrorMessage(error));
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve auctions" });
  }
};

const getSingleBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;

    if (!bid_id) {
      return res
        .status(400)
        .json({ success: false, message: "bid_id parameter is required" });
    }

    // result is typed as `BidRow | null`
    const result = await bidsService.getSingleBid(bid_id);

    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: "Auction not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Auction retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get single bid error:", getErrorMessage(error));
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve auction" });
  }
};

const updateBid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bid_id } = req.params;

    if (!bid_id) {
      return res
        .status(400)
        .json({ success: false, message: "bid_id parameter is required" });
    }

    await bidsService.updateBid(req.body, bid_id, req.user.user_id);

    return res.status(200).json({
      success: true,
      message: "Auction updated successfully",
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Update bid error:", message);

    if (message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message });
    }
    if (message.includes("closed")) {
      return res.status(400).json({ success: false, message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ success: false, message });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to update auction" });
  }
};

const deleteBid = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bid_id } = req.params;

    if (!bid_id) {
      return res
        .status(400)
        .json({ success: false, message: "bid_id parameter is required" });
    }

    await bidsService.deleteBid(bid_id, req.user.user_id);

    return res.status(200).json({
      success: true,
      message: "Auction deleted successfully",
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Delete bid error:", message);

    if (message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message });
    }
    if (message.includes("pending offers")) {
      return res.status(400).json({ success: false, message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ success: false, message });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to delete auction" });
  }
};

export const bidsController = {
  addBid,
  getBids,
  getSingleBid,
  updateBid,
  deleteBid,
  getMyBids,
};
