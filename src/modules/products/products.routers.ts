import { Router } from "express";
import { productController } from "./products.controller";

const router = Router();

router.post("/", productController.addProduct);
router.get("/", productController.getProducts);
router.get("/:product_id", productController.getSingleProduct);
router.get("/my-products/:seller_id", productController.getSellerProducts);
router.put("/:product_id", productController.updateProduct);
router.delete("/:product_id", productController.deleteProduct);

export const productRouter = router;
