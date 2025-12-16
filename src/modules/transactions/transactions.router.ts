import { Router } from "express";
import { transactionsController } from "./transactions.controller";
import auth from "../../middleware/auth";

const router = Router();

router.get("/", auth("admin"), transactionsController.getTransactions);

router.get("/my-transactions", auth(), transactionsController.getMyTransactions);

router.get(
  "/:transaction_id",
  auth(),
  transactionsController.getSingleTransaction
);

router.post("/", auth("admin"), transactionsController.addTransaction);


router.put(
  "/:transaction_id",
  auth("admin"),
  transactionsController.updateTransaction
);

router.delete(
  "/:transaction_id",
  auth("admin"),
  transactionsController.deleteTransaction
);



export const transactionsRouter = router;