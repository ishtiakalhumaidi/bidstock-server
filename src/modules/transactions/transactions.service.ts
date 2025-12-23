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
const getMyTransactions = async (
  role: string,
  id: string
) => {
  const [result] = await pool.query(
    `SELECT 
      t.*,
      p.name as product_name,
      p.image_url,
      u.name as counterparty_name
     FROM transactions t
     LEFT JOIN bids b ON t.bid_id = b.bid_id
     LEFT JOIN products p ON b.product_id = p.product_id
     LEFT JOIN users u ON (
        (t.from_id = u.user_id AND t.from_role != ?) OR 
        (t.to_id = u.user_id AND t.to_role != ?)
     )
     WHERE (t.from_role=? AND t.from_id=?)
        OR (t.to_role=? AND t.to_id=?)
     ORDER BY t.transaction_time DESC`,
    [role, role, role, id, role, id]
  );

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
