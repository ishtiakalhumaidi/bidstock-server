import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addTransaction = async (payload: Record<string, unknown>) => {
  const {
    bid_id,
    from_role,
    from_id,
    to_role,
    to_id,
    transaction_type,
    amount,
    status,
    payment_method,
    reference_id,
  } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO transactions(
      bid_id,
      from_role,
      from_id,
      to_role,
      to_id,
      transaction_type,
      amount,
      status,
      payment_method,
      reference_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      bid_id ?? null,
      from_role,
      from_id ?? null,
      to_role,
      to_id ?? null,
      transaction_type,
      amount,
      status ?? "completed",
      payment_method ?? null,
      reference_id ?? null,
    ]
  );

  return result.insertId;
};

const getTransactions = async () => {
  const result = await pool.query(`SELECT * FROM transactions`);
  return result;
};

const getSingleTransaction = async (id: string) => {
  const result = await pool.query(
    `SELECT * FROM transactions WHERE transaction_id=?`,
    [id]
  );
  return result;
};
const getMyTransactions = async (
  role: string,
  id: string
) => {
  const result = await pool.query(
    `SELECT * FROM transactions
     WHERE (from_role=? AND from_id=?)
        OR (to_role=? AND to_id=?)
     ORDER BY transaction_time DESC`,
    [role, id, role, id]
  );

  return result;
};


const updateTransaction = async (
  payload: Record<string, unknown>,
  id: string
) => {
  const {
    status,
    payment_method,
    reference_id,
  } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE transactions 
     SET status=?, payment_method=?, reference_id=? 
     WHERE transaction_id=?`,
    [
      status,
      payment_method,
      reference_id,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error("no transaction found to update");
  }

  return result;
};

const deleteTransaction = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM transactions WHERE transaction_id=?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no transaction found to delete");
  }

  return result;
};

export const transactionsService = {
  addTransaction,
  getTransactions,
  getSingleTransaction,
  getMyTransactions,
  updateTransaction,
  deleteTransaction,
};
