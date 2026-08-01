import { Router } from "express";
import { offersController } from "./offers.controller";
import auth from "../../middleware/auth";

const router = Router();

// Buyer routes
router.get("/my-offers", auth("buyer"), offersController.getMyOffers);
router.post("/", auth("buyer"), offersController.addOffer);
router.put("/:offer_id", auth("buyer"), offersController.updateOffer);

// Seller routes
router.get(
  "/bid/:bid_id",
  auth("seller", "admin"),
  offersController.getBidOffers
);
router.post("/:offer_id/accept", auth("seller"), offersController.acceptOffer);

// Shared/Admin routes
router.get("/", auth("admin"), offersController.getOffers);
router.get("/:offer_id", auth(), offersController.getSingleOffer);
router.delete("/:offer_id", auth(), offersController.deleteOffer);

export const offersRouter = router;