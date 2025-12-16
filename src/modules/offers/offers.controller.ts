import type { Request, Response } from "express";
import { offersService } from "./offers.service";

const addOffer = async (req: Request, res: Response) => {
  try {
    const result = await offersService.addOffer(req.body);
    return res.status(201).json({ success: true, message: "Offer placed successfully", data: { offer_id: result } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOffers = async (req: Request, res: Response) => {
  try {
    const result = await offersService.getOffers();
    return res.status(200).json({ success: true, message: "Offers retrieved successfully", data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getSingleOffer = async (req: Request, res: Response) => {
  try {
    const { offer_id } = req.params;
    const result = await offersService.getSingleOffer(offer_id as string);
    return res.status(200).json({ success: true, message: "Offer retrieved successfully", data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateOffer = async (req: Request, res: Response) => {
  try {
    const { offer_id } = req.params;
    await offersService.updateOffer(req.body, offer_id as string);
    return res.status(200).json({ success: true, message: "Offer updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteOffer = async (req: Request, res: Response) => {
  try {
    const { offer_id } = req.params;
    await offersService.deleteOffer(offer_id as string);
    return res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const offersController = { addOffer, getOffers, getSingleOffer, updateOffer, deleteOffer };
