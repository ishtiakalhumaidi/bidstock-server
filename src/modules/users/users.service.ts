// users.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import bcrypt from "bcryptjs";
import { BadRequest, Conflict, NotFound } from "../../utils/AppError";

const SALT_ROUNDS = 10;

const ALLOWED_UPDATE_FIELDS = [
  "name",
  "email",
  "phone",
  "user_image",
  "password",
];

const ADMIN_ONLY_FIELDS = ["role", "status"];
const VALID_ROLES = ["buyer", "seller", "warehouse_owner", "admin"];
const VALID_STATUSES = ["active", "inactive", "suspended"];

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetUsersQuery {
  page?: number | string;
  limit?: number | string;
  role?: "buyer" | "seller" | "warehouse_owner" | "admin";
  status?: "active" | "inactive" | "suspended";
  search?: string;
}

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

// ---- Service methods -----------------------------------------------------

const getUsers = async (query: GetUsersQuery = {}) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query.role) {
    whereClauses.push(`role = ?`);
    params.push(query.role);
  }
  if (query.status) {
    whereClauses.push(`status = ?`);
    params.push(query.status);
  }
  if (query.search) {
    whereClauses.push(`(name LIKE ? OR email LIKE ?)`);
    params.push(`%${query.search}%`, `%${query.search}%`);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM users ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id, email, phone, status, role, name, user_image, created_at, updated_at
      FROM users
      ${whereSQL}
     ORDER BY created_at DESC
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

const getSingleUser = async (user_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id, email, phone, status, role, name, user_image, created_at, updated_at
      FROM users
      WHERE user_id = ?`,
    [user_id]
  );

  return rows[0] ?? null;
};

export const getDashboardStats = async (user_id: string | number, role: string) => {
  const stats: Record<string, number> = {};

  // 1. Global Metrics (Applies to ALL roles)
  const [notifs] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as unread_count 
     FROM notifications 
     WHERE user_id = ? AND is_read = FALSE`,
    [user_id]
  );
  stats.unread_notifications = Number(notifs[0]?.unread_count ?? 0);

  // 2. Role-Specific Data Aggregation
  if (role === "seller") {
    const [
      revenueData,
      bidsData,
      inventoryData,
      rentsData,
      productsData,
      stockAlertsData
    ] = await Promise.all([
      // Total Revenue & Completed Sales Count
      pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as tx_count 
         FROM transactions 
         WHERE to_id = ? AND to_role = 'seller' AND status = 'completed'`,
        [user_id]
      ),
      // Active vs Closed Auctions
      pool.query<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as active_auctions,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_auctions
         FROM bids WHERE seller_id = ?`,
        [user_id]
      ),
      // Total Inventory Units Across All Warehouses
      pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(i.quantity), 0) as total 
         FROM inventory i 
         JOIN products p ON i.product_id = p.product_id 
         WHERE p.seller_id = ?`,
        [user_id]
      ),
      // Active Rented Warehouses
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM rents 
         WHERE seller_id = ? AND status = 'active'`,
        [user_id]
      ),
      // Active Product Listings
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM products 
         WHERE seller_id = ? AND status = 'active'`,
        [user_id]
      ),
      // Critical Inventory Warnings (Stock below min level)
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM inventory i 
         JOIN products p ON i.product_id = p.product_id 
         WHERE p.seller_id = ? AND i.quantity <= i.min_stock_level`,
        [user_id]
      )
    ]);

    stats.total_revenue = Number(revenueData[0][0]?.total ?? 0);
    stats.total_sales = Number(revenueData[0][0]?.tx_count ?? 0);
    stats.active_auctions = Number(bidsData[0][0]?.active_auctions ?? 0);
    stats.closed_auctions = Number(bidsData[0][0]?.closed_auctions ?? 0);
    stats.total_inventory = Number(inventoryData[0][0]?.total ?? 0);
    stats.active_rents = Number(rentsData[0][0]?.count ?? 0);
    stats.active_products = Number(productsData[0][0]?.count ?? 0);
    stats.low_stock_alerts = Number(stockAlertsData[0][0]?.count ?? 0);

  } else if (role === "buyer") {
    const [spentData, offersData] = await Promise.all([
      // Total Capital Deployed
      pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM transactions 
         WHERE from_id = ? AND from_role = 'buyer' AND status = 'completed'`,
        [user_id]
      ),
      // Offer Analytics (Pending Liability vs Won)
      pool.query<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'pending' THEN offered_price * quantity ELSE 0 END) as pending_liability,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as won_count,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as lost_count
         FROM offers WHERE buyer_id = ?`,
        [user_id]
      )
    ]);

    stats.total_spent = Number(spentData[0][0]?.total ?? 0);
    stats.pending_offers = Number(offersData[0][0]?.pending_count ?? 0);
    stats.pending_liability = Number(offersData[0][0]?.pending_liability ?? 0); // Shows capital tied up in bids
    stats.won_auctions = Number(offersData[0][0]?.won_count ?? 0);
    stats.lost_auctions = Number(offersData[0][0]?.lost_count ?? 0);

  } else if (role === "warehouse_owner") {
    const [earningsData, warehouseData, tenantData] = await Promise.all([
      // Yield / Earnings
      pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM transactions 
         WHERE to_id = ? AND to_role = 'warehouse_owner' AND status = 'completed'`,
        [user_id]
      ),
      // Asset Portfolio
      pool.query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as total_warehouses,
          COALESCE(SUM(capacity), 0) as total_capacity,
          COALESCE(SUM(floor_area_sqm), 0) as total_floor_space
         FROM warehouses WHERE owner_id = ?`,
        [user_id]
      ),
      // Tenant Acquisition
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT r.seller_id) as unique_tenants, COUNT(*) as active_leases 
         FROM rents r 
         JOIN warehouses w ON r.warehouse_id = w.warehouse_id 
         WHERE w.owner_id = ? AND r.status = 'active'`,
        [user_id]
      )
    ]);

    stats.total_earnings = Number(earningsData[0][0]?.total ?? 0);
    stats.total_warehouses = Number(warehouseData[0][0]?.total_warehouses ?? 0);
    stats.total_capacity = Number(warehouseData[0][0]?.total_capacity ?? 0);
    stats.total_floor_space = Number(warehouseData[0][0]?.total_floor_space ?? 0);
    stats.unique_tenants = Number(tenantData[0][0]?.unique_tenants ?? 0);
    stats.active_leases = Number(tenantData[0][0]?.active_leases ?? 0);
  }

  return stats;
};

const updateUser = async (
  payload: Record<string, unknown>,
  user_id: string,
  isAdmin: boolean = false
) => {
  const allowedFields = isAdmin
    ? [...ALLOWED_UPDATE_FIELDS, ...ADMIN_ONLY_FIELDS]
    : ALLOWED_UPDATE_FIELDS;

  const keys = Object.keys(payload).filter(
    (key) => allowedFields.includes(key) && payload[key] !== undefined
  );

  if (keys.length === 0) {
    throw BadRequest("No valid fields provided for update");
  }

  if (keys.includes("email")) {
    const email = String(payload.email).trim().toLowerCase();
    if (!email.includes("@") || email.length < 5) {
      throw BadRequest("Invalid email format");
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT user_id FROM users WHERE email = ? AND user_id != ?`,
      [email, user_id]
    );

    if (existing.length > 0) {
      throw Conflict("Email already in use by another account");
    }
  }

  if (keys.includes("role") && !VALID_ROLES.includes(payload.role as string)) {
    throw BadRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
  }

  if (keys.includes("status") && !VALID_STATUSES.includes(payload.status as string)) {
    throw BadRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const values: unknown[] = [];
  const setClauses: string[] = [];

  for (const key of keys) {
    if (key === "password") {
      const plainPassword = String(payload[key]);
      if (plainPassword.length < 6) {
        throw BadRequest("Password must be at least 6 characters");
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
    throw NotFound("User not found");
  }

  return result;
};

const deleteUser = async (user_id: string) => {
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM users WHERE user_id = ?`,
    [user_id]
  );

  if (userRows.length === 0) {
    throw NotFound("User not found");
  }

  const [activeBids] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM bids WHERE seller_id = ? AND status = 'open'`,
    [user_id]
  );

  if (Number(activeBids[0]?.count ?? 0) > 0) {
    throw BadRequest("Cannot delete user: has active auctions. Close them first.");
  }

  const [activeRents] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM rents WHERE seller_id = ? AND status = 'active'`,
    [user_id]
  );

  if (Number(activeRents[0]?.count ?? 0) > 0) {
    throw BadRequest("Cannot delete user: has active warehouse rentals.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM users WHERE user_id = ?`,
    [user_id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No user found to delete");
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