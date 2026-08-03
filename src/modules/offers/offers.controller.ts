// offers.controller.ts
import type { Request, Response } from "express";
import { offersService } from "./offers.service";
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

const addOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const payload = { ...req.body, buyer_id: req.user.user_id };
    const result = await offersService.addOffer(payload);
    return res.status(201).json({
      success: true,
      message: "Offer submitted successfully",
      data: { offer_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to submit offer");
  }
};

const getOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, status, bid_id, buyer_id } = req.query;
    const result = await offersService.getOffers(req.user.role as string, {
      page: page as string,
      limit: limit as string,
      status: status as "pending" | "accepted" | "rejected",
      bid_id: bid_id as string,
      buyer_id: buyer_id as string,
    });
    return res.status(200).json({
      success: true,
      message: "Offers retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve offers");
  }
};

const getSingleOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { offer_id } = req.params;
    const result = await offersService.getSingleOffer(
      offer_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Offer retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve offer");
  }
};

const getBidOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { bid_id } = req.params;
    const { page, limit } = req.query;
    const result = await offersService.getBidOffers(
      bid_id as string,
      req.user.user_id as number,
      req.user.role as string,
      page as string,
      limit as string
    );
    return res.status(200).json({
      success: true,
      message: "Bid offers retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve bid offers");
  }
};

const updateOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { offer_id } = req.params;
    await offersService.updateOffer(
      req.body,
      offer_id as string,
      req.user.user_id as number
    );
    return res.status(200).json({
      success: true,
      message: "Offer updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update offer");
  }
};

const deleteOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { offer_id } = req.params;
    await offersService.deleteOffer(
      offer_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete offer");
  }
};

const acceptOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { offer_id } = req.params;
    const result = await offersService.acceptOffer(
      offer_id as string,
      String(req.user.user_id)
    );
    return res.status(200).json({
      success: true,
      message: "Offer accepted successfully",
      data: { transaction_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to accept offer");
  }
};

const getMyOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit } = req.query;
    const result = await offersService.getMyOffers(
      String(req.user.user_id),
      page as string,
      limit as string
    );
    return res.status(200).json({
      success: true,
      message: "My offers retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve my offers");
  }
};

export const offersController = {
  addOffer,
  getOffers,
  getSingleOffer,
  getBidOffers,
  updateOffer,
  deleteOffer,
  acceptOffer,
  getMyOffers,
};