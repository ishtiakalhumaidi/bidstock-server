import { Router } from "express";
import { productController } from "./products.controller";
import auth from "../../middleware/auth";

const router = Router();

router.post("/", auth("seller"), productController.addProduct);
router.get("/", productController.getProducts);
router.get("/:product_id", productController.getSingleProduct);
router.get("/my-products/", auth(), productController.getSellerProducts);
router.put(
  "/:product_id",
  auth("admin", "seller"),
  productController.updateProduct
);
router.delete(
  "/:product_id",
  auth("admin", "seller"),
  productController.deleteProduct
);

export const productRouter = router;
