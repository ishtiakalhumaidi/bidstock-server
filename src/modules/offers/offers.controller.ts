import type { Request, Response } from "express";
import { offersService } from "./offers.service";

const addOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ success: false, message: "Only buyers can place offers" });
    }

    const payload = {
        ...req.body,
        buyer_id: req.user.user_id // Force the logged-in user ID
    };

    const result = await offersService.addOffer(payload);
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

const getBidOffers = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;
    const result = await offersService.getBidOffers(bid_id as string);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const acceptOffer = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const { offer_id } = req.params;
    
    await offersService.acceptOffer(offer_id as string, req.user.user_id as string);

    return res.status(200).json({ 
      success: true, 
      message: "Offer accepted, auction closed, and transaction created." 
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMyOffers = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    
    const result = await offersService.getMyOffers(req.user.user_id as string);

    return res.status(200).json({
      success: true,
      message: "My offers retrieved successfully",
      data: result,
    });
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

export const offersController = { addOffer, 
  getOffers, 
  getBidOffers, 
  acceptOffer, 
  getSingleOffer, getMyOffers,
  updateOffer, 
  deleteOffer};
