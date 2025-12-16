import { Router } from "express";
import { offersController } from "./offers.controller";

const router = Router();

router.get("/", offersController.getOffers);
router.get("/:offer_id", offersController.getSingleOffer);
router.post("/", offersController.addOffer);
router.put("/:offer_id", offersController.updateOffer);
router.delete("/:offer_id", offersController.deleteOffer);

export const offersRouter = router;
