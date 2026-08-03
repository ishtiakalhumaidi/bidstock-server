// transactions.controller.ts
import type { Request, Response } from "express";
import { transactionsService } from "./transactions.service";
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

const addTransaction = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const result = await transactionsService.addTransaction(
      req.body,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(201).json({
      success: true,
      message: "Transaction added successfully",
      data: { transaction_id: result },
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to add transaction");
  }
};

const getTransactions = async (req: Request, res: Response) => {
  try {
    const { page, limit, status, transaction_type, bid_id } = req.query;
    const result = await transactionsService.getTransactions({
      page: page as string,
      limit: limit as string,
      status: status as "pending" | "completed" | "failed",
      transaction_type: transaction_type as "payment" | "refund" | "commission" | "warehouse_fee",
      bid_id: bid_id as string,
    });
    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve transactions");
  }
};

const getSingleTransaction = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { transaction_id } = req.params;
    const result = await transactionsService.getSingleTransaction(
      transaction_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Transaction retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve transaction");
  }
};

const getMyTransactions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, status, transaction_type } = req.query;
    const result = await transactionsService.getMyTransactions(
      req.user.role as string,
      String(req.user.user_id),
      {
        page: page as string,
        limit: limit as string,
        status: status as "pending" | "completed" | "failed",
        transaction_type: transaction_type as "payment" | "refund" | "commission" | "warehouse_fee",
      }
    );
    return res.status(200).json({
      success: true,
      message: "My transactions retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve transactions");
  }
};

const payTransaction = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { transaction_id } = req.params;
    await transactionsService.payTransaction(
      transaction_id as string,
      req.user.user_id as number
    );
    return res.status(200).json({
      success: true,
      message: "Payment completed successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to process payment");
  }
};

const updateTransaction = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { transaction_id } = req.params;
    await transactionsService.updateTransaction(
      req.body,
      transaction_id as string,
      req.user.user_id as number,
      req.user.role as string
    );
    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update transaction");
  }
};

const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    await transactionsService.deleteTransaction(transaction_id as string);
    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete transaction");
  }
};

export const transactionsController = {
  addTransaction,
  getTransactions,
  getSingleTransaction,
  getMyTransactions,
  updateTransaction,
  payTransaction,
  deleteTransaction,
};