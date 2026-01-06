import type { Request, Response } from "express";
import { productService } from "./products.service";
import type { JwtPayload } from "jsonwebtoken";

const addProduct = async (req: Request, res: Response) => {
  try {
    if(!req.user){
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const result = await productService.addProduct(req.body, req.user.user_id as string);

    return res.status(201).json({
      success: true,
      message: "product added successfully",
      data: { product_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getProducts = async (req: Request, res: Response) => {
  try {
    const result = await productService.getProducts();

    return res.status(200).json({
      success: true,
      message: "products retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getSingleProduct = async (req: Request, res: Response) => {
  try {
    const { product_id } = req.params;
    const result = await productService.getSingleProduct(product_id as string);

    return res.status(200).json({
      success: true,
      message: "product retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSellerProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: no user info",
      });
    }
    const { user_id } = req.user as JwtPayload;

    const products = await productService.getSellerProducts(user_id as string);

    return res.status(200).json({
      success: true,
      data: products[0],
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProduct = async (req: Request, res: Response) => {
  try {
    const { product_id } = req.params;
    
    const result = await productService.updateProduct(
      req.body,
      product_id as string
    );

    return res.status(200).json({
      success: true,
      message: "product data updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { product_id } = req.params;
    const result = await productService.deleteProduct(product_id as string);

    return res.status(200).json({
      success: true,
      message: "product deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const productController = {
  addProduct,
  getProducts,
  getSingleProduct,
  getSellerProducts,
  updateProduct,
  deleteProduct,
};
