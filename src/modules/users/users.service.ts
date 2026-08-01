import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Whitelist of columns users can update (prevents SQL injection)
const ALLOWED_UPDATE_FIELDS = [
  "name",
  "email",
  "phone",
  "user_image",
  "password",
];

const getUsers = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id, email, phone, status, role, name, user_image, created_at, updated_at 
     FROM users 
     ORDER BY created_at DESC 
     LIMIT 200`
  );
  return rows;
};

const getSingleUser = async (user_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id, email, phone, status, role, name, user_image, created_at, updated_at 
     FROM users 
     WHERE user_id = ?`,
    [user_id]
  );
  return rows[0] ?? null;
};

const getDashboardStats = async (user_id: string, role: string) => {
  const stats: Record<string, number> = {};

  if (role === "seller") {
    const [revenue] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE to_id = ? AND to_role = 'seller' AND status = 'completed'`,
      [user_id]
    );
    stats.total_revenue = Number(revenue[0]?.total ?? 0);

    const [activeBids] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM bids 
       WHERE seller_id = ? AND status = 'open'`,
      [user_id]
    );
    stats.active_auctions = Number(activeBids[0]?.count ?? 0);

    const [inv] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(i.quantity), 0) as total 
       FROM inventory i 
       JOIN products p ON i.product_id = p.product_id 
       WHERE p.seller_id = ?`,
      [user_id]
    );
    stats.total_inventory = Number(inv[0]?.total ?? 0);

    const [rents] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM rents 
       WHERE seller_id = ? AND status = 'active'`,
      [user_id]
    );
    stats.active_rents = Number(rents[0]?.count ?? 0);
  } else if (role === "buyer") {
    const [spent] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE from_id = ? AND from_role = 'buyer' AND status = 'completed'`,
      [user_id]
    );
    stats.total_spent = Number(spent[0]?.total ?? 0);

    const [offers] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM offers 
       WHERE buyer_id = ? AND status = 'pending'`,
      [user_id]
    );
    stats.pending_offers = Number(offers[0]?.count ?? 0);

    const [wins] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM offers 
       WHERE buyer_id = ? AND status = 'accepted'`,
      [user_id]
    );
    stats.won_auctions = Number(wins[0]?.count ?? 0);
  } else if (role === "warehouse_owner") {
    const [earnings] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE to_id = ? AND to_role = 'warehouse_owner' AND status = 'completed'`,
      [user_id]
    );
    stats.total_earnings = Number(earnings[0]?.total ?? 0);

    const [warehouses] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM warehouses 
       WHERE owner_id = ?`,
      [user_id]
    );
    stats.total_warehouses = Number(warehouses[0]?.count ?? 0);

    const [tenants] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM rents r 
       JOIN warehouses w ON r.warehouse_id = w.warehouse_id 
       WHERE w.owner_id = ? AND r.status = 'active'`,
      [user_id]
    );
    stats.active_tenants = Number(tenants[0]?.count ?? 0);
  }

  return stats;
};

const updateUser = async (
  payload: Record<string, unknown>,
  user_id: string
) => {
  // Filter to allowed fields only (prevents SQL injection)
  const keys = Object.keys(payload).filter(
    (key) => ALLOWED_UPDATE_FIELDS.includes(key) && payload[key] !== undefined
  );

  if (keys.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  // Validate email if changing
  if (keys.includes("email")) {
    const email = String(payload.email).trim().toLowerCase();
    if (!email.includes("@") || email.length < 5) {
      throw new Error("Invalid email format");
    }

    // Check for duplicate email (excluding self)
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT user_id FROM users WHERE email = ? AND user_id != ?`,
      [email, user_id]
    );
    if (existing.length > 0) {
      throw new Error("Email already in use by another account");
    }
  }

  // Hash password if changing
  const values: unknown[] = [];
  const setClauses: string[] = [];

  for (const key of keys) {
    if (key === "password") {
      const plainPassword = String(payload[key]);
      if (plainPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      setClauses.push(`${key} = ?`);
      values.push(hashed);
    } else {
      setClauses.push(`${key} = ?`);
      values.push(payload[key]);
    }
  }

  values.push(user_id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE users SET ${setClauses.join(", ")} WHERE user_id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new Error("User not found");
  }

  return result;
};

const deleteUser = async (user_id: string) => {
  // Check if user exists
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM users WHERE user_id = ?`,
    [user_id]
  );
  if (userRows.length === 0) {
    throw new Error("User not found");
  }

  // Check for active data that would be orphaned
  const [activeBids] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM bids WHERE seller_id = ? AND status = 'open'`,
    [user_id]
  );
  if (Number(activeBids[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete user: has active auctions. Close them first.");
  }

  const [activeRents] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM rents WHERE seller_id = ? AND status = 'active'`,
    [user_id]
  );
  if (Number(activeRents[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete user: has active warehouse rentals.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM users WHERE user_id = ?`,
    [user_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No user found to delete");
  }

  return result;
};

export const userService = {
  getUsers,
  getSingleUser,
  updateUser,
  getDashboardStats,
  deleteUser,
};