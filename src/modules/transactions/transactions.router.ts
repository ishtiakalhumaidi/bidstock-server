import { Router } from "express";
import { transactionsController } from "./transactions.controller";
import auth from "../../middleware/auth";

const router = Router();

// Admin only
router.get("/", auth("admin"), transactionsController.getTransactions);
router.delete("/:transaction_id", auth("admin"), transactionsController.deleteTransaction);

// Any authenticated user
router.get("/my-transactions", auth(), transactionsController.getMyTransactions);

// Transaction detail (must be involved or admin)
router.get("/:transaction_id", auth(), transactionsController.getSingleTransaction);

// Create transaction (admin can create for anyone, others only for self)
router.post("/", auth(), transactionsController.addTransaction);

// Update transaction (must be involved or admin)
router.put("/:transaction_id", auth(), transactionsController.updateTransaction);

// Buyer pays for their transaction
router.patch("/:transaction_id/pay", auth("buyer"), transactionsController.payTransaction);

export const transactionsRouter = router;