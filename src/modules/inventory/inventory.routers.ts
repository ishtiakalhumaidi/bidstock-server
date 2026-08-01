import { Router } from "express";
import { inventoryController } from "./inventory.controller";
import auth from "../../middleware/auth";

const router = Router();

// Public/Admin inventory overview
router.get("/", auth("admin"), inventoryController.getInventories);

// Seller's own inventory
router.get("/my-inventory", auth("seller"), inventoryController.getMyInventory);

// Single inventory lookup (any authenticated user)
router.get("/:product_id/:warehouse_id", auth(), inventoryController.getSingleInventory);

// Add inventory (seller only - must own product and rent warehouse)
router.post("/add", auth("seller"), inventoryController.addInventory);

// Update inventory (seller owns product, warehouse_owner owns warehouse, or admin)
router.put(
  "/:product_id/:warehouse_id",
  auth("admin", "seller", "warehouse_owner"),
  inventoryController.updateInventory
);

// Delete inventory (seller owns product, warehouse_owner owns warehouse, or admin)
router.delete(
  "/:product_id/:warehouse_id",
  auth("admin", "seller", "warehouse_owner"),
  inventoryController.deleteInventory
);

export const inventoryRouter = router;  