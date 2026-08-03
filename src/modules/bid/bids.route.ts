import { Router } from "express";
import { bidsController } from "./bids.controller";
import auth from "../../middleware/auth";

const router = Router();

// 1. Static / Named routes FIRST
router.get("/", bidsController.getBids);
router.get("/my-bids", auth("seller"), bidsController.getMyBids); // 👈 Moved up here!

// 2. Dynamic ID routes LAST
router.get("/:bid_id", bidsController.getSingleBid);

// Protected mutation routes
router.post("/", auth("seller"), bidsController.addBid);
router.put("/:bid_id", auth("seller"), bidsController.updateBid);
router.delete("/:bid_id", auth("seller"), bidsController.deleteBid);

export const bidsRouter = router;