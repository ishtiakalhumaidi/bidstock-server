import { Router } from "express";
import { warehouseController } from "./warehouse.controller";

const router = Router();

router.get("/", warehouseController.getWarehouses);
router.get("/:warehouse_id", warehouseController.getSingleWarehouse);
router.post("/", warehouseController.addWarehouse);
router.put("/:warehouse_id", warehouseController.updateWarehouse);
router.delete("/:warehouse_id", warehouseController.deleteWarehouse);

export const warehouseRouter = router;
