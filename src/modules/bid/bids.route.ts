import { Router } from "express";
import { bidsController } from "./bids.controller";
import auth from "../../middleware/auth";

const router = Router();

router.get("/", bidsController.getBids);
router.get("/my-bids", auth("seller"), bidsController.getMyBids);
router.get("/:bid_id", bidsController.getSingleBid);
router.post("/", bidsController.addBid);
router.put("/:bid_id", bidsController.updateBid);
router.delete("/:bid_id", bidsController.deleteBid);

export const bidsRouter = router;
