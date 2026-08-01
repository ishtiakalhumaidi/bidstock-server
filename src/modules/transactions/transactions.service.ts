import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

interface TransactionRow extends RowDataPacket {
  transaction_id: number;
  bid_id: number | null;
  from_role: string;
  from_id: number | null;
  to_role: string;
  to_id: number | null;
  transaction_type: string;
  amount: number;
  status: string;
  payment_method: string | null;
  reference_id: string | null;
  transaction_time: Date;
}

const addTransaction = async (
  payload: Record<string, unknown>,
  user_id: number,
  user_role: string
) => {
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

  // Validation
  if (!from_role || !to_role || !transaction_type || amount === undefined) {
    throw new Error("from_role, to_role, transaction_type, and amount are required");
  }

  const txAmount = parseFloat(String(amount));
  if (isNaN(txAmount) || txAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  // If not admin, force from_id to self
  const finalFromId = user_role === 'admin' ? (from_id ?? user_id) : user_id;

  // Validate role enums
  const validRoles = ['buyer', 'seller', 'warehouse_owner', 'platform'];
  if (!validRoles.includes(from_role as string) || !validRoles.includes(to_role as string)) {
    throw new Error("Invalid role specified");
  }

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
      finalFromId,
      to_role,
      to_id ?? null,
      transaction_type,
      txAmount,
      status ?? "pending",
      payment_method ?? null,
      reference_id ?? null,
    ]
  );

  return result.insertId;
};

const getTransactions = async () => {
  const [rows] = await pool.query<TransactionRow[]>(
    `SELECT t.*, 
      b.bid_id,
      p.name as product_name,
      p.image_url,
      from_u.name as from_name,
      to_u.name as to_name
     FROM transactions t
     LEFT JOIN bids b ON t.bid_id = b.bid_id
     LEFT JOIN products p ON b.product_id = p.product_id
     LEFT JOIN users from_u ON t.from_id = from_u.user_id
     LEFT JOIN users to_u ON t.to_id = to_u.user_id
     ORDER BY t.transaction_time DESC
     LIMIT 200`
  );
  return rows;
};

const getSingleTransaction = async (id: string, user_id: number, user_role: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*,
      p.name as product_name,
      p.image_url,
      from_u.name as from_name,
      to_u.name as to_name
     FROM transactions t
     LEFT JOIN bids b ON t.bid_id = b.bid_id
     LEFT JOIN products p ON b.product_id = p.product_id
     LEFT JOIN users from_u ON t.from_id = from_u.user_id
     LEFT JOIN users to_u ON t.to_id = to_u.user_id
     WHERE t.transaction_id = ?`,
    [id]
  );

  if (rows.length === 0) throw new Error("Transaction not found");

  const tx = rows[0] as any;
  const isInvolved = tx.from_id === user_id || tx.to_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isInvolved && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to view this transaction");
  }

  return tx;
};

const getMyTransactions = async (role: string, id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      t.*,
      p.name as product_name,
      p.image_url,
      CASE 
        WHEN t.from_id = ? THEN to_u.name
        ELSE from_u.name
      END as counterparty_name,
      CASE 
        WHEN t.from_id = ? THEN t.to_role
        ELSE t.from_role
      END as counterparty_role
     FROM transactions t
     LEFT JOIN bids b ON t.bid_id = b.bid_id
     LEFT JOIN products p ON b.product_id = p.product_id
     LEFT JOIN users from_u ON t.from_id = from_u.user_id
     LEFT JOIN users to_u ON t.to_id = to_u.user_id
     WHERE (t.from_role = ? AND t.from_id = ?)
        OR (t.to_role = ? AND t.to_id = ?)
     ORDER BY t.transaction_time DESC`,
    [id, id, role, id, role, id]
  );

  return rows;
};

const updateTransaction = async (
  payload: Record<string, unknown>,
  id: string,
  user_id: number,
  user_role: string
) => {
  // Verify ownership
  const [txRows] = await pool.query<TransactionRow[]>(
    `SELECT * FROM transactions WHERE transaction_id = ?`,
    [id]
  );
  if (txRows.length === 0) throw new Error("Transaction not found");

  const tx = txRows[0]!;
  const isInvolved = tx.from_id === user_id || tx.to_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isInvolved && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to update this transaction");
  }

  const { status, payment_method, reference_id } = payload;

  // Non-admins can only update status to certain values
  if (!isAdmin && status) {
    const allowedStatuses = ['pending', 'completed', 'failed'];
    if (!allowedStatuses.includes(status as string)) {
      throw new Error("Invalid status value");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE transactions 
     SET status = COALESCE(?, status), 
         payment_method = COALESCE(?, payment_method), 
         reference_id = COALESCE(?, reference_id)
     WHERE transaction_id = ?`,
    [status ?? null, payment_method ?? null, reference_id ?? null, id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No transaction found to update");
  }

  return result;
};

const payTransaction = async (transaction_id: string, user_id: number) => {
  // Verify user owns this transaction (is the buyer/from_id)
  const [txRows] = await pool.query<TransactionRow[]>(
    `SELECT * FROM transactions WHERE transaction_id = ? AND from_id = ?`,
    [transaction_id, user_id]
  );

  if (txRows.length === 0) {
    throw new Error("Transaction not found or unauthorized");
  }

  const tx = txRows[0]!;

  if (tx.status === "completed") {
    throw new Error("Transaction already paid");
  }

  if (tx.status === "failed") {
    throw new Error("Cannot pay a failed transaction");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE transactions 
     SET status = ?, payment_method = ? 
     WHERE transaction_id = ?`,
    ["completed", "wallet", transaction_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("Failed to process payment");
  }

  return result;
};

const deleteTransaction = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM transactions WHERE transaction_id = ?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No transaction found to delete");
  }

  return result;
};

export const transactionsService = {
  addTransaction,
  getTransactions,
  getSingleTransaction,
  getMyTransactions,
  updateTransaction,
  payTransaction,
  deleteTransaction,
};