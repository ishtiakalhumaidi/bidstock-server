import type { Request, Response } from "express";
import { transactionsService } from "./transactions.service";

const addTransaction = async (req: Request, res: Response) => {
  try {
    const result = await transactionsService.addTransaction(req.body);

    return res.status(201).json({
      success: true,
      message: "transaction added successfully",
      data: { transaction_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTransactions = async (req: Request, res: Response) => {
  try {
    const result = await transactionsService.getTransactions();

    return res.status(200).json({
      success: true,
      message: "transactions retrieved successfully",
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

const getSingleTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;

    const result = await transactionsService.getSingleTransaction(
      transaction_id as string
    );

    return res.status(200).json({
      success: true,
      message: "transaction retrieved successfully",
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

const getMyTransactions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const role = req.user.role; 
    const id = req.user.user_id;

    const result = await transactionsService.getMyTransactions(
      role as string,
      id as string
    );

    return res.status(200).json({
      success: true,
      message: "my transactions retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;

    await transactionsService.updateTransaction(
      req.body,
      transaction_id as string
    );

    return res.status(200).json({
      success: true,
      message: "transaction updated successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;

    await transactionsService.deleteTransaction(
      transaction_id as string
    );

    return res.status(200).json({
      success: true,
      message: "transaction deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const transactionsController = {
  addTransaction,
  getTransactions,
  getSingleTransaction,
  getMyTransactions,
  updateTransaction,
  deleteTransaction,
};
