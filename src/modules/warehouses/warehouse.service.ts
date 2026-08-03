// warehouse.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { inventoryService } from "../inventory/inventory.service";
import { BadRequest, Forbidden, NotFound, Conflict } from "../../utils/AppError";

interface WarehouseRow extends RowDataPacket {
  warehouse_id: number;
  owner_id: number;
  location: string;
  price_per_day: number;
  capacity: number;
  status: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

// ASSUMPTION: confirm these match the ENUM in db.ts exactly
const VALID_STATUSES = ["available", "booked", "maintenance"];

export interface GetWarehousesQuery {
  page?: number | string;
  limit?: number | string;
  status?: string;
  location?: string;
  min_price?: number | string;
  max_price?: number | string;
  min_capacity?: number | string;
  search?: string;
}

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(
    100,
    Math.max(1, parseInt(String(limit ?? 20), 10) || 20),
  );
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

// ---- Service methods -----------------------------------------------------

const addWarehouse = async (
  payload: Record<string, unknown>,
  owner_id: number,
) => {
  const {
    location,
    capacity,
    price_per_day,
    floor_area_sqm,
    ceiling_height_m,
  } = payload;

  if (
    !location ||
    typeof location !== "string" ||
    location.trim().length === 0
  ) {
    throw BadRequest("Location is required");
  }

  if (location.trim().length > 255) {
    throw BadRequest("Location must be 255 characters or less");
  }

  const cap = parseInt(String(capacity), 10);
  if (isNaN(cap) || cap <= 0) {
    throw BadRequest("Capacity must be a positive number");
  }

  const price = parseFloat(String(price_per_day));
  if (isNaN(price) || price < 0) {
    throw BadRequest("Price per day must be a non-negative number");
  }

  let floorArea: number | null = null;
  if (
    floor_area_sqm !== undefined &&
    floor_area_sqm !== null &&
    floor_area_sqm !== ""
  ) {
    floorArea = parseFloat(String(floor_area_sqm));
    if (isNaN(floorArea) || floorArea <= 0) {
      throw BadRequest("Floor area must be a positive number");
    }
  }

  let ceilingHeight: number | null = null;
  if (
    ceiling_height_m !== undefined &&
    ceiling_height_m !== null &&
    ceiling_height_m !== ""
  ) {
    ceilingHeight = parseFloat(String(ceiling_height_m));
    if (isNaN(ceilingHeight) || ceilingHeight <= 0) {
      throw BadRequest("Ceiling height must be a positive number");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO warehouses(owner_id, location, capacity, price_per_day, floor_area_sqm, ceiling_height_m, status)
      VALUES(?, ?, ?, ?, ?, ?, 'available')`,
    [
      owner_id,
      location.toString().trim(),
      cap,
      price,
      floorArea,
      ceilingHeight,
    ],
  );

  return result.insertId;
};

const expireOldRents = async () => {
  // Find all rents that are active but have passed their end_date
  const [expiredRows] = await pool.query<RowDataPacket[]>(
    `SELECT r.rent_id, r.seller_id, r.warehouse_id, w.owner_id, w.location 
     FROM rents r
     JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     WHERE r.status = 'active' AND r.end_date < CURDATE()`
  );

  if (expiredRows.length === 0) return;

  const rentIds = expiredRows.map((r) => r.rent_id);
  const warehouseIds = Array.from(new Set(expiredRows.map((r) => r.warehouse_id)));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Mark the rents as completed
    await connection.query(
      `UPDATE rents SET status = 'completed' WHERE rent_id IN (?)`,
      [rentIds]
    );

    // Free up the warehouses
    await connection.query(
      `UPDATE warehouses SET status = 'available' WHERE warehouse_id IN (?)`,
      [warehouseIds]
    );

    // Notify both parties that the lease has naturally expired
    for (const row of expiredRows) {
      await connection.query(
        `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?)`,
        [row.seller_id, 'system', `Your lease for the warehouse at ${row.location} has ended.`, 'warehouse', row.warehouse_id]
      );
      
      await connection.query(
        `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?)`,
        [row.owner_id, 'system', `The lease for your warehouse at ${row.location} has ended. The space is now available.`, 'warehouse', row.warehouse_id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error("Auto-expire rents failed:", err);
  } finally {
    connection.release();
  }
};

const getWarehouses = async (query: GetWarehousesQuery = {}) => {
  await expireOldRents();

  const { pageNum, limitNum, offset } = parsePagination(
    query.page,
    query.limit,
  );

  const whereClauses: string[] = [`w.status != 'maintenance'`];
  const params: unknown[] = [];

  if (query.status) {
    if (!VALID_STATUSES.includes(query.status)) {
      throw BadRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }
    // overrides the default "!= maintenance" filter if explicitly requested
    whereClauses[0] = `w.status = ?`;
    params.push(query.status);
  }

  if (query.location) {
    whereClauses.push(`w.location LIKE ?`);
    params.push(`%${query.location}%`);
  }

  if (query.min_price !== undefined) {
    whereClauses.push(`w.price_per_day >= ?`);
    params.push(Number(query.min_price));
  }

  if (query.max_price !== undefined) {
    whereClauses.push(`w.price_per_day <= ?`);
    params.push(Number(query.max_price));
  }

  if (query.min_capacity !== undefined) {
    whereClauses.push(`w.capacity >= ?`);
    params.push(Number(query.min_capacity));
  }

  if (query.search) {
    whereClauses.push(`w.location LIKE ?`);
    params.push(`%${query.search}%`);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM warehouses w ${whereSQL}`,
    params,
  );
  const total = countRows[0]?.count ?? 0;

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
    ${whereSQL}
    ORDER BY w.status ASC, w.warehouse_id DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
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

const getMyWarehouses = async (
  owner_id: string,
  query: GetWarehousesQuery = {},
) => {
  await expireOldRents();

  const { pageNum, limitNum, offset } = parsePagination(
    query.page,
    query.limit,
  );

  const whereClauses: string[] = [`w.owner_id = ?`];
  const params: unknown[] = [owner_id];

  if (query.status) {
    if (!VALID_STATUSES.includes(query.status)) {
      throw BadRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }
    whereClauses.push(`w.status = ?`);
    params.push(query.status);
  }

  if (query.search) {
    whereClauses.push(`w.location LIKE ?`);
    params.push(`%${query.search}%`);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM warehouses w ${whereSQL}`,
    params,
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       w.*,
      COALESCE(inv.used_qty, 0) as used_quantity,
      COALESCE(r.tenant_count, 0) as tenant_count
    FROM warehouses w
    LEFT JOIN (
      SELECT 
         warehouse_id, 
         COALESCE(SUM(quantity), 0) as used_qty
      FROM inventory
      GROUP BY warehouse_id
    ) inv ON w.warehouse_id = inv.warehouse_id
    LEFT JOIN (
      SELECT warehouse_id, COUNT(*) as tenant_count 
       FROM rents 
       WHERE status = 'active' 
       GROUP BY warehouse_id
    ) r ON w.warehouse_id = r.warehouse_id
    ${whereSQL}
   ORDER BY w.warehouse_id DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
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
    [id],
  );

  if (rows.length === 0) return null;

  const warehouse = rows[0] as any;

  const utilization = await inventoryService.computeWarehouseUtilization(
    {
      floor_area_sqm: warehouse.floor_area_sqm,
      ceiling_height_m: warehouse.ceiling_height_m,
    },
    id,
  );
  warehouse.space_used_sqm = utilization?.usedSqm ?? null;
  warehouse.space_remaining_sqm = utilization?.remainingSqm ?? null;

  return warehouse;
};

const updateWarehouse = async (
  payload: Record<string, unknown>,
  id: string,
  user_id: number,
  user_role: string,
) => {
  const [whRows] = await pool.query<WarehouseRow[]>(
    `SELECT * FROM warehouses WHERE warehouse_id = ?`,
    [id],
  );

  if (whRows.length === 0) {
    throw NotFound("Warehouse not found");
  }

  const warehouse = whRows[0]!;
  const isOwner = warehouse.owner_id === user_id;
  const isAdmin = user_role === "admin";

  if (!isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not own this warehouse");
  }

  const {
    location,
    capacity,
    price_per_day,
    status,
    floor_area_sqm,
    ceiling_height_m,
  } = payload;

  if (location !== undefined) {
    if (typeof location !== "string" || location.trim().length === 0) {
      throw BadRequest("Location cannot be empty");
    }
    if (location.trim().length > 255) {
      throw BadRequest("Location must be 255 characters or less");
    }
  }

  let cap: number | null = null;
  if (capacity !== undefined) {
    cap = parseInt(String(capacity), 10);
    if (isNaN(cap) || cap <= 0) {
      throw BadRequest("Capacity must be a positive number");
    }
  }

  let price: number | null = null;
  if (price_per_day !== undefined) {
    price = parseFloat(String(price_per_day));
    if (isNaN(price) || price < 0) {
      throw BadRequest("Price per day must be a non-negative number");
    }
  }

  let floorArea: number | null = null;
  if (
    floor_area_sqm !== undefined &&
    floor_area_sqm !== null &&
    floor_area_sqm !== ""
  ) {
    floorArea = parseFloat(String(floor_area_sqm));
    if (isNaN(floorArea) || floorArea <= 0) {
      throw BadRequest("Floor area must be a positive number");
    }
  }

  let ceilingHeight: number | null = null;
  if (
    ceiling_height_m !== undefined &&
    ceiling_height_m !== null &&
    ceiling_height_m !== ""
  ) {
    ceilingHeight = parseFloat(String(ceiling_height_m));
    if (isNaN(ceilingHeight) || ceilingHeight <= 0) {
      throw BadRequest("Ceiling height must be a positive number");
    }
  }

  if (status !== undefined) {
    if (!isAdmin) {
      throw Forbidden("Forbidden: Only an admin can change warehouse status directly");
    }
    if (!VALID_STATUSES.includes(status as string)) {
      throw BadRequest(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE warehouses
    SET location = COALESCE(?, location),
        capacity = COALESCE(?, capacity),
        price_per_day = COALESCE(?, price_per_day),
        floor_area_sqm = COALESCE(?, floor_area_sqm),
       ceiling_height_m = COALESCE(?, ceiling_height_m),
       status = COALESCE(?, status)
   WHERE warehouse_id = ?`,
    [
      location ?? null,
      cap,
      price,
      floorArea,
      ceilingHeight,
      status ?? null,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    throw NotFound("No warehouse found to update");
  }

  return result;
};

const deleteWarehouse = async (
  id: string,
  user_id: number,
  user_role: string,
) => {
  const [whRows] = await pool.query<WarehouseRow[]>(
    `SELECT * FROM warehouses WHERE warehouse_id = ?`,
    [id],
  );

  if (whRows.length === 0) {
    throw NotFound("Warehouse not found");
  }

  const warehouse = whRows[0]!;
  const isOwner = warehouse.owner_id === user_id;
  const isAdmin = user_role === "admin";

  if (!isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not own this warehouse");
  }

  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM inventory WHERE warehouse_id = ? AND quantity > 0`,
    [id],
  );

  if ((invRows[0]?.count ?? 0) > 0) {
    throw Conflict(
      "Cannot delete: warehouse still has active inventory. Remove or transfer inventory first.",
    );
  }

  const [rentRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM rents WHERE warehouse_id = ? AND status = 'active'`,
    [id],
  );

  if ((rentRows[0]?.count ?? 0) > 0) {
    throw Conflict(
      "Cannot delete: warehouse has active rental agreements. Complete or cancel rentals first.",
    );
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM warehouses WHERE warehouse_id = ?`,
    [id],
  );

  if (result.affectedRows === 0) {
    throw NotFound("No warehouse found to delete");
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