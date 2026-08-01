import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

interface WarehouseRow extends RowDataPacket {
  warehouse_id: number;
  owner_id: number;
  location: string;
  price_per_day: number;
  capacity: number;
  status: string;
}

const addWarehouse = async (
  payload: Record<string, unknown>,
  owner_id: number
) => {
  const { location, capacity, price_per_day } = payload;

  if (!location || typeof location !== "string" || location.trim().length === 0) {
    throw new Error("Location is required");
  }
  if (location.trim().length > 255) {
    throw new Error("Location must be 255 characters or less");
  }

  const cap = parseInt(String(capacity), 10);
  if (isNaN(cap) || cap <= 0) {
    throw new Error("Capacity must be a positive number");
  }

  const price = parseFloat(String(price_per_day));
  if (isNaN(price) || price < 0) {
    throw new Error("Price per day must be a non-negative number");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO warehouses(owner_id, location, capacity, price_per_day, status) 
     VALUES(?, ?, ?, ?, 'available')`,
    [owner_id, location.toString().trim(), cap, price]
  );

  return result.insertId;
};

const expireOldRents = async () => {
  await pool.query<ResultSetHeader>(
    `UPDATE rents r
     JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     SET r.status = 'completed', w.status = 'available'
     WHERE r.status = 'active' AND r.end_date < CURDATE()`
  );
};

const getWarehouses = async () => {
  await expireOldRents();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      w.*,
      u.name as owner_name,
      u.email as owner_email,
      COALESCE(r.tenant_count, 0) as tenant_count
    FROM warehouses w
    JOIN users u ON w.owner_id = u.user_id
    LEFT JOIN (
      SELECT warehouse_id, COUNT(*) as tenant_count 
      FROM rents 
      WHERE status = 'active' 
      GROUP BY warehouse_id
    ) r ON w.warehouse_id = r.warehouse_id
    WHERE w.status != 'maintenance'
    ORDER BY w.status ASC, w.created_at DESC
    LIMIT 100`
  );
  return rows;
};

const getMyWarehouses = async (owner_id: string) => {
  await expireOldRents();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      w.*,
      COALESCE(inv.used_qty, 0) as used_quantity,
      COALESCE(inv.used_space, 0) as used_space,
      COALESCE(r.tenant_count, 0) as tenant_count
    FROM warehouses w
    LEFT JOIN (
      SELECT 
        warehouse_id, 
        COALESCE(SUM(quantity), 0) as used_qty,
        COALESCE(SUM(quantity), 0) as used_space
      FROM inventory
      GROUP BY warehouse_id
    ) inv ON w.warehouse_id = inv.warehouse_id
    LEFT JOIN (
      SELECT warehouse_id, COUNT(*) as tenant_count 
      FROM rents 
      WHERE status = 'active' 
      GROUP BY warehouse_id
    ) r ON w.warehouse_id = r.warehouse_id
    WHERE w.owner_id = ?
    ORDER BY w.created_at DESC`,
    [owner_id]
  );
  return rows;
};

const getSingleWarehouse = async (id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      w.*,
      u.name as owner_name,
      u.email as owner_email,
      COALESCE(inv.used_qty, 0) as used_quantity,
      COALESCE(r.tenant_count, 0) as tenant_count
    FROM warehouses w
    JOIN users u ON w.owner_id = u.user_id
    LEFT JOIN (
      SELECT warehouse_id, COALESCE(SUM(quantity), 0) as used_qty
      FROM inventory
      GROUP BY warehouse_id
    ) inv ON w.warehouse_id = inv.warehouse_id
    LEFT JOIN (
      SELECT warehouse_id, COUNT(*) as tenant_count 
      FROM rents 
      WHERE status = 'active' 
      GROUP BY warehouse_id
    ) r ON w.warehouse_id = r.warehouse_id
    WHERE w.warehouse_id = ?`,
    [id]
  );

  if (rows.length === 0) return null;
  return rows[0];
};

const updateWarehouse = async (
  payload: Record<string, unknown>,
  id: string,
  user_id: number,
  user_role: string
) => {
  // Verify ownership
  const [whRows] = await pool.query<WarehouseRow[]>(
    `SELECT * FROM warehouses WHERE warehouse_id = ?`,
    [id]
  );
  if (whRows.length === 0) {
    throw new Error("Warehouse not found");
  }

  const warehouse = whRows[0]!;
  const isOwner = warehouse.owner_id === user_id;
  const isAdmin = user_role === "admin";

  if (!isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not own this warehouse");
  }

  const { location, capacity, price_per_day, status } = payload;

  // Validation
  if (location !== undefined) {
    if (typeof location !== "string" || location.trim().length === 0) {
      throw new Error("Location cannot be empty");
    }
    if (location.trim().length > 255) {
      throw new Error("Location must be 255 characters or less");
    }
  }

  let cap: number | null = null;
  if (capacity !== undefined) {
    cap = parseInt(String(capacity), 10);
    if (isNaN(cap) || cap <= 0) {
      throw new Error("Capacity must be a positive number");
    }
  }

  let price: number | null = null;
  if (price_per_day !== undefined) {
    price = parseFloat(String(price_per_day));
    if (isNaN(price) || price < 0) {
      throw new Error("Price per day must be a non-negative number");
    }
  }

  // Non-owners cannot change status to maintenance or booked
  if (!isAdmin && status !== undefined && !isOwner) {
    throw new Error("Forbidden: You cannot change warehouse status");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE warehouses 
     SET location = COALESCE(?, location), 
         capacity = COALESCE(?, capacity), 
         price_per_day = COALESCE(?, price_per_day), 
         status = COALESCE(?, status)
     WHERE warehouse_id = ?`,
    [location ?? null, cap, price, status ?? null, id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No warehouse found to update");
  }

  return result;
};

const deleteWarehouse = async (
  id: string,
  user_id: number,
  user_role: string
) => {
  const [whRows] = await pool.query<WarehouseRow[]>(
    `SELECT * FROM warehouses WHERE warehouse_id = ?`,
    [id]
  );
  if (whRows.length === 0) {
    throw new Error("Warehouse not found");
  }

  const warehouse = whRows[0]!;
  const isOwner = warehouse.owner_id === user_id;
  const isAdmin = user_role === "admin";

  if (!isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not own this warehouse");
  }

  // Check for active inventory
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM inventory WHERE warehouse_id = ? AND quantity > 0`,
    [id]
  );
  if ((invRows[0]?.count ?? 0) > 0) {
    throw new Error(
      "Cannot delete: warehouse still has active inventory. Remove or transfer inventory first."
    );
  }

  // Check for active rents
  const [rentRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM rents WHERE warehouse_id = ? AND status = 'active'`,
    [id]
  );
  if ((rentRows[0]?.count ?? 0) > 0) {
    throw new Error(
      "Cannot delete: warehouse has active rental agreements. Complete or cancel rentals first."
    );
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM warehouses WHERE warehouse_id = ?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No warehouse found to delete");
  }

  return result;
};

export const warehouseService = {
  addWarehouse,
  getWarehouses,
  getSingleWarehouse,
  getMyWarehouses,
  updateWarehouse,
  deleteWarehouse,
};