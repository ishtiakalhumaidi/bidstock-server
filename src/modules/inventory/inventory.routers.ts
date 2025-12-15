import { Router } from "express";
import { inventoryController } from "./inventory.controller";

const router = Router();

router.get("/", inventoryController.getInventories);
router.get(
  "/:product_id/:warehouse_id",
  inventoryController.getSingleInventory
);
router.post("/", inventoryController.addInventory);
router.put("/:product_id/:warehouse_id", inventoryController.updateInventory);
router.delete(
  "/:product_id/:warehouse_id",
  inventoryController.deleteInventory
);

export const inventoryRouter = router;
