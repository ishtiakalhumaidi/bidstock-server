import { Router } from "express";
import { rentController } from "./rent.controller";

const router = Router();

router.get("/", rentController.getRents);
router.get("/me/:seller_id", rentController.getMyRents);
router.get("/:rent_id", rentController.getSingleRent);
router.post("/", rentController.addRent);
router.put("/:rent_id", rentController.updateRent);
router.delete("/:rent_id", rentController.deleteRent);

export const rentRouter = router;
