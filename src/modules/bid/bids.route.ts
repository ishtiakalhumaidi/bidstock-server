import { Router } from "express";
import { bidsController } from "./bids.controller";

const router = Router();

router.get("/", bidsController.getBids);
router.get("/:bid_id", bidsController.getSingleBid);
router.post("/", bidsController.addBid);
router.put("/:bid_id", bidsController.updateBid);
router.delete("/:bid_id", bidsController.deleteBid);

export const bidsRouter = router;
