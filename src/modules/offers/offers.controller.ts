import type { Request, Response } from "express";
import { offersService } from "./offers.service";

const addOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (req.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: "Only buyers can place offers" });
    }

    const payload = {
      ...req.body,
      buyer_id: req.user.user_id,
    };

    const result = await offersService.addOffer(payload);
    return res.status(201).json({
      success: true,
      message: "Offer placed successfully",
      data: { offer_id: result },
    });
  } catch (error: any) {
    console.error("Add offer error:", error.message);

    if (error.message.includes("required")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes("Auction not found") || error.message.includes("expired") || error.message.includes("closed")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("higher than") || error.message.includes("already have") || error.message.includes("self-bidding") || error.message.includes("Invalid")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to place offer" });
  }
};

const getOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await offersService.getOffers(req.user.role as string);
    return res.status(200).json({
      success: true,
      message: "Offers retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get offers error:", error.message);
    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to retrieve offers" });
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
    console.error("Get single offer error:", error.message);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to retrieve offer" });
  }
};

const getBidOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bid_id } = req.params;
    const result = await offersService.getBidOffers(
      bid_id as string,
      req.user.user_id as number,
      req.user.role as string
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Get bid offers error:", error.message);
    if (error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to retrieve offers" });
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
      message: "Offer accepted, auction closed, and transaction created.",
      data: { transaction_id: result },
    });
  } catch (error: any) {
    console.error("Accept offer error:", error.message);

    if (error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("already closed") || error.message.includes("completed")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to accept offer" });
  }
};

const getMyOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await offersService.getMyOffers(String(req.user.user_id));

    return res.status(200).json({
      success: true,
      message: "My offers retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get my offers error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve offers" });
  }
};

const updateOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { offer_id } = req.params;
    await offersService.updateOffer(req.body, offer_id as string, req.user.user_id as number);

    return res.status(200).json({
      success: true,
      message: "Offer updated successfully",
    });
  } catch (error: any) {
    console.error("Update offer error:", error.message);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("Cannot update") || error.message.includes("Invalid")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to update offer" });
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
    console.error("Delete offer error:", error.message);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("Cannot delete")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to delete offer" });
  }
};

export const offersController = {
  addOffer,
  getOffers,
  getSingleOffer,
  getBidOffers,
  acceptOffer,
  getMyOffers,
  updateOffer,
  deleteOffer,
};