import { Router } from "express";
import { bidsController } from "./bids.controller";
import auth from "../../middleware/auth";

const router = Router();

// Public routes
router.get("/", bidsController.getBids);
router.get("/:bid_id", bidsController.getSingleBid);

// Protected seller routes
router.get("/my-bids", auth("seller"), bidsController.getMyBids);
router.post("/", auth("seller"), bidsController.addBid);
router.put("/:bid_id", auth("seller"), bidsController.updateBid);
router.delete("/:bid_id", auth("seller"), bidsController.deleteBid);

export const bidsRouter = router;