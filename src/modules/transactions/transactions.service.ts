// transactions.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

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

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetTransactionsQuery {
  page?: number | string;
  limit?: number | string;
  status?: "pending" | "completed" | "failed";
  transaction_type?: "payment" | "refund" | "commission" | "warehouse_fee";
  bid_id?: number | string;
}

const VALID_ROLES = ["buyer", "seller", "warehouse_owner", "platform"];
const VALID_TYPES = ["payment", "refund", "commission", "warehouse_fee"];

const ROLE_TABLE: Record<string, string> = {
  buyer: "buyers",
  seller: "sellers",
  warehouse_owner: "warehouse_owners",
};

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

const verifyRoleUser = async (role: string, id: unknown, label: "from" | "to") => {
  if (role === "platform") return;
  if (id === null || id === undefined) {
    throw BadRequest(`${label}_id is required when ${label}_role is not 'platform'`);
  }
  const table = ROLE_TABLE[role];
  if (!table) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM ${table} WHERE user_id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw BadRequest(`Invalid ${label}_id: no ${role} found with that id`);
  }
};

// ---- Service methods -----------------------------------------------------

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

  if (!from_role || !to_role || !transaction_type || amount === undefined) {
    throw BadRequest("from_role, to_role, transaction_type, and amount are required");
  }

  const txAmount = parseFloat(String(amount));
  if (isNaN(txAmount) || txAmount <= 0) {
    throw BadRequest("Amount must be a positive number");
  }

  if (!VALID_ROLES.includes(from_role as string) || !VALID_ROLES.includes(to_role as string)) {
    throw BadRequest("Invalid role specified");
  }

  if (!VALID_TYPES.includes(transaction_type as string)) {
    throw BadRequest(`Invalid transaction_type. Must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const finalFromId = user_role === 'admin' ? (from_id ?? user_id) : user_id;

  await verifyRoleUser(from_role as string, finalFromId, "from");
  await verifyRoleUser(to_role as string, to_id, "to");

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO transactions(
      bid_id, from_role, from_id, to_role, to_id,
      transaction_type, amount, status, payment_method, reference_id
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

const getTransactions = async (query: GetTransactionsQuery = {}) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    whereClauses.push(`t.status = ?`);
    params.push(query.status);
  }
  if (query.transaction_type) {
    whereClauses.push(`t.transaction_type = ?`);
    params.push(query.transaction_type);
  }
  if (query.bid_id) {
    whereClauses.push(`t.bid_id = ?`);
    params.push(query.bid_id);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM transactions t ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<TransactionRow[]>(
    `SELECT t.*, 
      COALESCE(p.name, w.location) as product_name,
      p.image_url,
      from_u.name as from_name,
      to_u.name as to_name
     FROM transactions t
     LEFT JOIN bids b ON t.bid_id = b.bid_id
     LEFT JOIN products p ON b.product_id = p.product_id
     LEFT JOIN rents r ON t.transaction_type = 'warehouse_fee' AND r.rent_id = SUBSTRING_INDEX(SUBSTRING_INDEX(t.reference_id, '-', 2), '-', -1)
     LEFT JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     LEFT JOIN users from_u ON t.from_id = from_u.user_id
     LEFT JOIN users to_u ON t.to_id = to_u.user_id
     ${whereSQL}
     ORDER BY t.transaction_time DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const getSingleTransaction = async (id: string, user_id: number, user_role: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*,
      COALESCE(p.name, w.location) as product_name,
      p.image_url,
      from_u.name as from_name,
      to_u.name as to_name
     FROM transactions t
     LEFT JOIN bids b ON t.bid_id = b.bid_id
     LEFT JOIN products p ON b.product_id = p.product_id
     LEFT JOIN rents r ON t.transaction_type = 'warehouse_fee' AND r.rent_id = SUBSTRING_INDEX(SUBSTRING_INDEX(t.reference_id, '-', 2), '-', -1)
     LEFT JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     LEFT JOIN users from_u ON t.from_id = from_u.user_id
     LEFT JOIN users to_u ON t.to_id = to_u.user_id
     WHERE t.transaction_id = ?`,
    [id]
  );

  if (rows.length === 0) throw NotFound("Transaction not found");

  const tx = rows[0] as any;
  const isInvolved = tx.from_id === user_id || tx.to_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isInvolved && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to view this transaction");
  }

  return tx;
};

const getMyTransactions = async (
  role: string,
  id: string,
  query: GetTransactionsQuery = {}
) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [
    `((t.from_role = ? AND t.from_id = ?) OR (t.to_role = ? AND t.to_id = ?))`,
  ];
  const params: unknown[] = [role, id, role, id];

  if (query.status) {
    whereClauses.push(`t.status = ?`);
    params.push(query.status);
  }
  if (query.transaction_type) {
    whereClauses.push(`t.transaction_type = ?`);
    params.push(query.transaction_type);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM transactions t ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       t.*,
      COALESCE(p.name, w.location) as product_name,
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
     LEFT JOIN rents r ON t.transaction_type = 'warehouse_fee' AND r.rent_id = SUBSTRING_INDEX(SUBSTRING_INDEX(t.reference_id, '-', 2), '-', -1)
     LEFT JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     LEFT JOIN users from_u ON t.from_id = from_u.user_id
     LEFT JOIN users to_u ON t.to_id = to_u.user_id
     ${whereSQL}
     ORDER BY t.transaction_time DESC
     LIMIT ? OFFSET ?`,
    [id, id, ...params, limitNum, offset]
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const updateTransaction = async (
  payload: Record<string, unknown>,
  id: string,
  user_id: number,
  user_role: string
) => {
  const [txRows] = await pool.query<TransactionRow[]>(
    `SELECT * FROM transactions WHERE transaction_id = ?`,
    [id]
  );
  if (txRows.length === 0) throw NotFound("Transaction not found");

  const tx = txRows[0]!;
  const isInvolved = tx.from_id === user_id || tx.to_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isInvolved && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to update this transaction");
  }

  const { status, payment_method, reference_id } = payload;

  if (!isAdmin && status !== undefined) {
    throw Forbidden("Forbidden: Only admins can change transaction status directly. Use the payment endpoint instead.");
  }

  if (isAdmin && status !== undefined) {
    const allowedStatuses = ['pending', 'completed', 'failed'];
    if (!allowedStatuses.includes(status as string)) {
      throw BadRequest("Invalid status value");
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
    throw NotFound("No transaction found to update");
  }

  return result;
};

const payTransaction = async (transaction_id: string, user_id: number) => {
  const [txRows] = await pool.query<TransactionRow[]>(
    `SELECT * FROM transactions WHERE transaction_id = ? AND from_id = ?`,
    [transaction_id, user_id]
  );

  if (txRows.length === 0) {
    throw NotFound("Transaction not found or unauthorized");
  }

  const tx = txRows[0]!;

  if (tx.status === "completed") {
    throw BadRequest("Transaction already paid");
  }
  if (tx.status === "failed") {
    throw BadRequest("Cannot pay a failed transaction");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE transactions
      SET status = ?, payment_method = ?
      WHERE transaction_id = ?`,
    ["completed", "wallet", transaction_id]
  );

  if (result.affectedRows === 0) {
    throw BadRequest("Failed to process payment");
  }

  try {
    if (tx.to_id) {
      await pool.query<ResultSetHeader>(
        `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          tx.to_id,
          'transaction',
          `Payment received! A transaction of $${tx.amount} has been completed to your wallet.`,
          'transaction',
          transaction_id,
        ]
      );
    }
  } catch (notifErr) {
    console.error("Payment notification failed:", notifErr);
  }

  return result;
};

const deleteTransaction = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM transactions WHERE transaction_id = ?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No transaction found to delete");
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