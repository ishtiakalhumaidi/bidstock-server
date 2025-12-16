import { Router } from "express";
import { warehouseController } from "./warehouse.controller";
import auth from "../../middleware/auth";

const router = Router();

router.get("/", warehouseController.getWarehouses);
router.get("/:warehouse_id", warehouseController.getSingleWarehouse);
router.post("/", auth("warehouse_owner"), warehouseController.addWarehouse);
router.put(
  "/:warehouse_id",
  auth("warehouse_owner", "admin"),
  warehouseController.updateWarehouse
);
router.delete(
  "/:warehouse_id",
  auth("warehouse_owner", "admin"),
  warehouseController.deleteWarehouse
);

export const warehouseRouter = router;
