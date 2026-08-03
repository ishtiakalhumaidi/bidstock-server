// products.controller.ts
import type { Request, Response } from "express";
import { productService } from "./products.service";
import { AppError } from "../../utils/AppError";

const handleError = (res: Response, error: any, fallbackMessage: string) => {
  console.error(fallbackMessage, error.message);
  if (error instanceof AppError) {
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const addProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const result = await productService.addProduct(req.body, String(req.user.user_id));
    return res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: { product_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to add product");
  }
};

const getProducts = async (req: Request, res: Response) => {
  try {
    const { page, limit, category, brand, min_price, max_price, search } = req.query;
    const result = await productService.getProducts({
      page: page as string,
      limit: limit as string,
      category: category as string,
      brand: brand as string,
      min_price: min_price as string,
      max_price: max_price as string,
      search: search as string,
    });
    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve products");
  }
};

const getSingleProduct = async (req: Request, res: Response) => {
  try {
    const { product_id } = req.params;
    const result = await productService.getSingleProduct(product_id as string);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve product");
  }
};

const getSellerProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const { page, limit, category, brand, status, min_price, max_price, search } = req.query;
    const result = await productService.getSellerProducts(String(req.user.user_id), {
      page: page as string,
      limit: limit as string,
      category: category as string,
      brand: brand as string,
      status: status as "active" | "inactive" | "discontinued",
      min_price: min_price as string,
      max_price: max_price as string,
      search: search as string,
    });
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve products");
  }
};

const updateProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const { product_id } = req.params;
    await productService.updateProduct(
      req.body,
      product_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update product");
  }
};

const deleteProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const { product_id } = req.params;
    await productService.deleteProduct(
      product_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete product");
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