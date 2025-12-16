import { Router } from "express";
import { transactionsController } from "./transactions.controller";

const router = Router();

router.get("/", transactionsController.getTransactions);
router.get(
  "/me/:role/:id",
  transactionsController.getMyTransactions
);
router.get(
  "/:transaction_id",
  transactionsController.getSingleTransaction
);
router.post("/", transactionsController.addTransaction);
router.put(
  "/:transaction_id",
  transactionsController.updateTransaction
);
router.delete(
  "/:transaction_id",
  transactionsController.deleteTransaction
);

export const transactionsRouter = router;
