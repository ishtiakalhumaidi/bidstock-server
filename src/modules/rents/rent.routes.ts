import { Router } from "express";
import { rentController } from "./rent.controller";
import auth from "../../middleware/auth";

const router = Router();

// Public routes (or admin only)
router.get("/", auth("admin", "warehouse_owner"), rentController.getRents);
router.get("/my-rents", auth("seller"), rentController.getMyRents);
router.get("/:rent_id", auth(), rentController.getSingleRent);

// Seller routes
router.post("/", auth("seller"), rentController.addRent);

// Warehouse owner routes
router.get("/warehouse/:warehouse_id", auth("warehouse_owner", "admin"), rentController.getWarehouseRents);

// Update/Delete (seller or admin)
router.put("/:rent_id", auth("seller", "admin"), rentController.updateRent);
router.delete("/:rent_id", auth("seller", "admin"), rentController.deleteRent);

export const rentRouter = router;