import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

interface WarehouseRow extends RowDataPacket {
  warehouse_id: number;
  owner_id: number;
  capacity: number;
  status: string;
  price_per_day: number;
  location: string;
  floor_area_sqm: number;
  ceiling_height_m: number;
}

interface RentRow extends RowDataPacket {
  rent_id: number;
  seller_id: number;
  warehouse_id: number;
  start_date: string;
  end_date: string | null;
  status: string;
  rental_price: number | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetRentsQuery {
  page?: number | string;
  limit?: number | string;
  status?: "active" | "completed" | "cancelled";
  warehouse_id?: number | string;
}

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

const calculateDays = (start: string, end: string | null): number => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate);
  endDate.setDate(endDate.getDate() + 30); // Default 30 days if no end_date
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// ---- Service methods -----------------------------------------------------

const addRent = async (payload: Record<string, unknown>, user_id: number) => {
  const { warehouse_id, start_date, end_date } = payload;

  if (!warehouse_id || !start_date) {
    throw BadRequest("warehouse_id and start_date are required");
  }

  const start = new Date(start_date as string);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (start < now) {
    throw BadRequest("Start date cannot be in the past");
  }

  if (end_date) {
    const end = new Date(end_date as string);
    if (end <= start) {
      throw BadRequest("End date must be after start date");
    }
  }

  const [warehouseRows] = await pool.query<WarehouseRow[]>(
    `SELECT warehouse_id, owner_id, capacity, status, price_per_day, location
      FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  if (warehouseRows.length === 0) {
    throw NotFound("Warehouse not found");
  }

  const warehouse = warehouseRows[0]!;

  if (warehouse.status === 'maintenance') {
    throw BadRequest("Warehouse is currently under maintenance");
  }

  const [overlapRows] = await pool.query<RowDataPacket[]>(
    `SELECT rent_id FROM rents
      WHERE warehouse_id = ?
      AND status = 'active'
      AND start_date <= ?
      AND (end_date IS NULL OR end_date >= ?)`,
    [warehouse_id, end_date || '9999-12-31', start_date]
  );

  if (overlapRows.length > 0) {
    throw BadRequest("Warehouse is already rented for this period");
  }

  const days = calculateDays(start_date as string, end_date as string | null);
  const rentalPrice = parseFloat(String(warehouse.price_per_day || 0)) * days;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Create the lease agreement
    const [rentResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO rents(
        seller_id, warehouse_id, start_date, end_date, rental_price, status
      ) VALUES (?,?,?,?,?,?)`,
      [user_id, warehouse_id, start_date, end_date ?? null, rentalPrice, 'active']
    );
    const rentId = rentResult.insertId;

    // 2. Lock the entire warehouse
    await connection.query<ResultSetHeader>(
      `UPDATE warehouses SET status = 'booked' WHERE warehouse_id = ?`,
      [warehouse_id]
    );

    // 3. Record transaction ledger entry
    await connection.query<ResultSetHeader>(
      `INSERT INTO transactions(
        bid_id, from_role, from_id, to_role, to_id,
        transaction_type, amount, status, payment_method, reference_id
      ) VALUES (NULL, 'seller', ?, 'warehouse_owner', ?, 'warehouse_fee', ?, 'completed', 'card', ?)`,
      [
        user_id,
        warehouse.owner_id,
        rentalPrice,
        `RENT-${rentId}-${Date.now()}`
      ]
    );

    // 4. Fire notifications
    await connection.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        warehouse.owner_id,
        'system',
        `A new lease has been secured for your warehouse at ${warehouse.location}.`,
        'warehouse',
        warehouse_id,
      ]
    );

    await connection.commit();
    return rentId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getRents = async (user_role: string, query: GetRentsQuery = {}) => {
  if (user_role !== 'admin' && user_role !== 'warehouse_owner') {
    throw Forbidden("Forbidden: Admin or warehouse owner access required");
  }

  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    whereClauses.push(`r.status = ?`);
    params.push(query.status);
  }
  if (query.warehouse_id) {
    whereClauses.push(`r.warehouse_id = ?`);
    params.push(query.warehouse_id);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM rents r ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  // JOIN integration for physical metrics
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       r.*,
      u.name as seller_name,
      u.email as seller_email,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity,
      w.floor_area_sqm,
      w.ceiling_height_m,
      w.price_per_day
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    ${whereSQL}
    ORDER BY r.created_at DESC
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

const getSingleRent = async (rent_id: string, user_id: number, user_role: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       r.*,
      u.name as seller_name,
      u.email as seller_email,
      u.phone as seller_phone,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity,
      w.floor_area_sqm,
      w.ceiling_height_m,
      w.owner_id,
      w.price_per_day
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    WHERE r.rent_id = ?`,
    [rent_id]
  );

  if (rows.length === 0) throw NotFound("Rent not found");

  const rent = rows[0] as any;
  const isSeller = rent.seller_id === user_id;
  const isOwner = rent.owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isSeller && !isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to view this rent");
  }

  return rent;
};

const getMyRents = async (seller_id: string, query: GetRentsQuery = {}) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [`r.seller_id = ?`];
  const params: unknown[] = [seller_id];

  if (query.status) {
    whereClauses.push(`r.status = ?`);
    params.push(query.status);
  }
  if (query.warehouse_id) {
    whereClauses.push(`r.warehouse_id = ?`);
    params.push(query.warehouse_id);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM rents r ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  // JOIN integration for physical metrics
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       r.*,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity,
      w.floor_area_sqm,
      w.ceiling_height_m,
      w.price_per_day,
      wo.user_id as owner_id,
      u.name as owner_name,
      u.email as owner_email,
      u.phone as owner_phone
    FROM rents r
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    JOIN warehouse_owners wo ON w.owner_id = wo.user_id
    JOIN users u ON wo.user_id = u.user_id
    ${whereSQL}
    ORDER BY r.start_date DESC
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

const getWarehouseRents = async (
  warehouse_id: string,
  user_id: number,
  user_role: string,
  query: GetRentsQuery = {}
) => {
  const [whRows] = await pool.query<RowDataPacket[]>(
    `SELECT owner_id FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  if (whRows.length === 0) throw NotFound("Warehouse not found");

  const isOwner = (whRows[0] as any).owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not own this warehouse");
  }

  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [`r.warehouse_id = ?`];
  const params: unknown[] = [warehouse_id];

  if (query.status) {
    whereClauses.push(`r.status = ?`);
    params.push(query.status);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM rents r ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       r.*,
      w.floor_area_sqm,
      w.ceiling_height_m,
      u.name as seller_name,
      u.email as seller_email,
      u.phone as seller_phone
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    ${whereSQL}
    ORDER BY r.start_date DESC
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

const updateRent = async (
  payload: Record<string, unknown>,
  rent_id: string,
  user_id: number,
  user_role: string
) => {
  const [rentRows] = await pool.query<RentRow[]>(
    `SELECT r.*, w.owner_id 
     FROM rents r
     JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     WHERE r.rent_id = ?`,
    [rent_id]
  );

  if (rentRows.length === 0) throw NotFound("Rent not found");

  const rent = rentRows[0]!;
  const isSeller = rent.seller_id === user_id;
  const isOwner = rent.owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isSeller && !isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to update this rent");
  }

  if (isSeller && !isAdmin && rent.status !== 'active') {
    throw BadRequest("Cannot update a completed or cancelled rent");
  }

  const { start_date, end_date, status } = payload;

  if (start_date || end_date) {
    const newStart = start_date ? new Date(start_date as string) : new Date(rent.start_date);
    const newEnd = end_date ? new Date(end_date as string) : (rent.end_date ? new Date(rent.end_date) : null);

    if (end_date && newEnd && newEnd <= newStart) {
      throw BadRequest("End date must be after start date");
    }

    const [overlapRows] = await pool.query<RowDataPacket[]>(
      `SELECT rent_id FROM rents
        WHERE warehouse_id = ? 
        AND rent_id != ?
        AND status = 'active'
        AND start_date <= ?
        AND (end_date IS NULL OR end_date >= ?)`,
      [
        rent.warehouse_id,
        rent_id,
        end_date || '9999-12-31',
        start_date || rent.start_date
      ]
    );

    if (overlapRows.length > 0) {
      throw BadRequest("Updated dates conflict with existing rent");
    }
  }

  let newRentalPrice: number | null = null;
  if (start_date || end_date) {
    const days = calculateDays(
      (start_date as string) || rent.start_date,
      (end_date as string) || rent.end_date
    );

    const [whRows] = await pool.query<RowDataPacket[]>(
      `SELECT price_per_day FROM warehouses WHERE warehouse_id = ?`,
      [rent.warehouse_id]
    );
    const pricePerDay = parseFloat(String((whRows[0] as any)?.price_per_day || 0));
    newRentalPrice = pricePerDay * days;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE rents
      SET start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          status = COALESCE(?, status),
          rental_price = COALESCE(?, rental_price)
     WHERE rent_id = ?`,
    [start_date ?? null, end_date ?? null, status ?? null, newRentalPrice, rent_id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No rent found to update");
  }

  if (status === 'completed' || status === 'cancelled') {
    const [activeRows] = await pool.query<RowDataPacket[]>(
      `SELECT rent_id FROM rents WHERE warehouse_id = ? AND status = 'active' AND rent_id != ?`,
      [rent.warehouse_id, rent_id]
    );
    if (activeRows.length === 0) {
      await pool.query<ResultSetHeader>(
        `UPDATE warehouses SET status = 'available' WHERE warehouse_id = ?`,
        [rent.warehouse_id]
      );
    }
  }

  return result;
};

const deleteRent = async (rent_id: string, user_id: number, user_role: string) => {
  const [rentRows] = await pool.query<RentRow[]>(
    `SELECT r.*, w.owner_id 
     FROM rents r
     JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     WHERE r.rent_id = ?`,
    [rent_id]
  );

  if (rentRows.length === 0) throw NotFound("Rent not found");

  const rent = rentRows[0]!;
  const isSeller = rent.seller_id === user_id;
  const isOwner = rent.owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isSeller && !isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to delete this rent");
  }

  const [inventoryRows] = await pool.query<RowDataPacket[]>(
    `SELECT inventory_id FROM inventory
      WHERE warehouse_id = ? AND product_id IN (SELECT product_id FROM products WHERE seller_id = ?)
      AND quantity > 0`,
    [rent.warehouse_id, rent.seller_id]
  );

  if (inventoryRows.length > 0) {
    throw BadRequest("Cannot delete rent: inventory still exists in this warehouse. Remove inventory first.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM rents WHERE rent_id = ?`,
    [rent_id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No rent found to delete");
  }

  const [activeRows] = await pool.query<RowDataPacket[]>(
    `SELECT rent_id FROM rents WHERE warehouse_id = ? AND status = 'active'`,
    [rent.warehouse_id]
  );

  if (activeRows.length === 0) {
    await pool.query<ResultSetHeader>(
      `UPDATE warehouses SET status = 'available' WHERE warehouse_id = ?`,
      [rent.warehouse_id]
    );
  }

  return result;
};

export const rentService = {
  addRent,
  getRents,
  getSingleRent,
  getMyRents,
  getWarehouseRents,
  updateRent,
  deleteRent,
};