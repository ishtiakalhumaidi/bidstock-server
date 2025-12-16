import { Router } from "express";
import { inventoryController } from "./inventory.controller";
import auth from "../../middleware/auth";

const router = Router();
router.get(
  "/",
  auth(),
  inventoryController.getInventories
);

router.get("/my-inventory", auth("seller"), inventoryController.getMyInventory);
router.get(
  "/:product_id/:warehouse_id",
  inventoryController.getSingleInventory
);

router.post("/", auth("seller"), inventoryController.addInventory);

router.put(
  "/:product_id/:warehouse_id",
  auth("admin", "seller"),
  inventoryController.updateInventory
);

router.delete(
  "/:product_id/:warehouse_id",
  auth("admin", "seller"),
  inventoryController.deleteInventory
);

export const inventoryRouter = router;
