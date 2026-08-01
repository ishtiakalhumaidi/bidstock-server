import type { Request, Response } from "express";
import { transactionsService } from "./transactions.service";

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
    console.error("Add transaction error:", error.message);

    if (error.message.includes("required") || error.message.includes("must be") || error.message.includes("Invalid")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to add transaction" });
  }
};

const getTransactions = async (req: Request, res: Response) => {
  try {
    const result = await transactionsService.getTransactions();

    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get transactions error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve transactions" });
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
    console.error("Get single transaction error:", error.message);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to retrieve transaction" });
  }
};

const getMyTransactions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await transactionsService.getMyTransactions(
      req.user.role as string,
      String(req.user.user_id)
    );

    return res.status(200).json({
      success: true,
      message: "My transactions retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get my transactions error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve transactions" });
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
    console.error("Pay transaction error:", error.message);

    if (error.message.includes("unauthorized") || error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("already paid") || error.message.includes("failed") || error.message.includes("Cannot pay")) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to process payment" });
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
    console.error("Update transaction error:", error.message);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("Invalid")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to update transaction" });
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
    console.error("Delete transaction error:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to delete transaction" });
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