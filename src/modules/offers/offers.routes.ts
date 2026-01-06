import { Router } from "express";
import { offersController } from "./offers.controller";
import auth from "../../middleware/auth";

const router = Router();

router.get("/my-offers", auth("buyer"), offersController.getMyOffers);
router.get("/", offersController.getOffers);
router.get(
  "/bid/:bid_id",
  auth("seller", "admin"),
  offersController.getBidOffers
);
router.post("/:offer_id/accept", auth("seller"), offersController.acceptOffer);
router.get("/:offer_id", offersController.getSingleOffer);
router.post("/", auth("buyer"), offersController.addOffer);
router.put("/:offer_id", offersController.updateOffer);
router.delete("/:offer_id", offersController.deleteOffer);

export const offersRouter = router;
