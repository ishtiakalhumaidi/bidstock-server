import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

interface WarehouseRow extends RowDataPacket {
  warehouse_id: number;
  owner_id: number;
  capacity: number;
  status: string;
  price_per_day: number;
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

const calculateDays = (start: string, end: string | null): number => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate);
  endDate.setDate(endDate.getDate() + 30); // Default 30 days if no end_date
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

const addRent = async (payload: Record<string, unknown>, user_id: number) => {
  const { warehouse_id, start_date, end_date } = payload;

  if (!warehouse_id || !start_date) {
    throw new Error("warehouse_id and start_date are required");
  }

  // Validate dates
  const start = new Date(start_date as string);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (start < now) {
    throw new Error("Start date cannot be in the past");
  }

  if (end_date) {
    const end = new Date(end_date as string);
    if (end <= start) {
      throw new Error("End date must be after start date");
    }
  }

  // Verify warehouse exists and is available
  const [warehouseRows] = await pool.query<WarehouseRow[]>(
    `SELECT warehouse_id, owner_id, capacity, status, price_per_day 
     FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  if (warehouseRows.length === 0) {
    throw new Error("Warehouse not found");
  }

  const warehouse = warehouseRows[0]!;

  if (warehouse.status === 'maintenance') {
    throw new Error("Warehouse is currently under maintenance");
  }

  // Check for date overlap with ANY active rent for this warehouse
  const [overlapRows] = await pool.query<RowDataPacket[]>(
    `SELECT rent_id FROM rents 
     WHERE warehouse_id = ? 
     AND status = 'active'
     AND (
       (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
     )`,
    [warehouse_id, end_date || '9999-12-31', start_date]
  );

  if (overlapRows.length > 0) {
    throw new Error("Warehouse is already rented for this period");
  }

  // Calculate rental price
  const days = calculateDays(start_date as string, end_date as string | null);
  const rentalPrice = parseFloat(String(warehouse.price_per_day || 0)) * days;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO rents(
      seller_id,
      warehouse_id,
      start_date,
      end_date,
      rental_price,
      status
    ) VALUES (?,?,?,?,?,?)`,
    [user_id, warehouse_id, start_date, end_date ?? null, rentalPrice, 'active']
  );

  // Mark warehouse as booked
  await pool.query<ResultSetHeader>(
    `UPDATE warehouses SET status = 'booked' WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  return result.insertId;
};

const getRents = async (user_role: string) => {
  if (user_role !== 'admin' && user_role !== 'warehouse_owner') {
    throw new Error("Forbidden: Admin or warehouse owner access required");
  }

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      r.*,
      u.name as seller_name,
      u.email as seller_email,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity,
      w.price_per_day
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    ORDER BY r.created_at DESC
    LIMIT 200
  `);
  return rows;
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
      w.owner_id,
      w.price_per_day
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    WHERE r.rent_id = ?`,
    [rent_id]
  );

  if (rows.length === 0) throw new Error("Rent not found");

  const rent = rows[0] as any;
  const isSeller = rent.seller_id === user_id;
  const isOwner = rent.owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isSeller && !isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to view this rent");
  }

  return rent;
};

const getMyRents = async (seller_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      r.*,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity,
      w.price_per_day,
      wo.user_id as owner_id,
      u.name as owner_name,
      u.email as owner_email,
      u.phone as owner_phone
    FROM rents r
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    JOIN warehouse_owners wo ON w.owner_id = wo.user_id
    JOIN users u ON wo.user_id = u.user_id
    WHERE r.seller_id = ? 
    ORDER BY r.start_date DESC`,
    [seller_id]
  );
  return rows;
};

const getWarehouseRents = async (warehouse_id: string, user_id: number, user_role: string) => {
  // Verify ownership
  const [whRows] = await pool.query<RowDataPacket[]>(
    `SELECT owner_id FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );
  if (whRows.length === 0) throw new Error("Warehouse not found");

  const isOwner = (whRows[0] as any).owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not own this warehouse");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      r.*,
      u.name as seller_name,
      u.email as seller_email,
      u.phone as seller_phone
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    WHERE r.warehouse_id = ? 
    ORDER BY r.start_date DESC`,
    [warehouse_id]
  );
  return rows;
};

const updateRent = async (
  payload: Record<string, unknown>,
  rent_id: string,
  user_id: number,
  user_role: string
) => {
  // Verify rent exists and get ownership
  const [rentRows] = await pool.query<RentRow[]>(
    `SELECT r.*, w.owner_id 
     FROM rents r
     JOIN warehouses w ON r.warehouse_id = w.warehouse_id
     WHERE r.rent_id = ?`,
    [rent_id]
  );

  if (rentRows.length === 0) throw new Error("Rent not found");
  const rent = rentRows[0]!;

  const isSeller = rent.seller_id === user_id;
  const isOwner = rent.owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isSeller && !isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to update this rent");
  }

  // Sellers can only update their own pending/active rents
  if (isSeller && !isAdmin && rent.status !== 'active' && rent.status !== 'pending') {
    throw new Error("Cannot update a completed or cancelled rent");
  }

  const { start_date, end_date, status } = payload;

  // Validate dates if provided
  if (start_date || end_date) {
    const newStart = start_date ? new Date(start_date as string) : new Date(rent.start_date);
    const newEnd = end_date ? new Date(end_date as string) : (rent.end_date ? new Date(rent.end_date) : null);

    if (end_date && newEnd && newEnd <= newStart) {
      throw new Error("End date must be after start date");
    }

    // Check overlap with OTHER rents for same warehouse
    const [overlapRows] = await pool.query<RowDataPacket[]>(
      `SELECT rent_id FROM rents 
       WHERE warehouse_id = ? 
       AND rent_id != ?
       AND status = 'active'
       AND (
         (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
       )`,
      [
        rent.warehouse_id,
        rent_id,
        end_date || '9999-12-31',
        start_date || rent.start_date
      ]
    );

    if (overlapRows.length > 0) {
      throw new Error("Updated dates conflict with existing rent");
    }
  }

  // Calculate new rental price if dates changed
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
    throw new Error("No rent found to update");
  }

  // If completed or cancelled, free up warehouse if no other active rents
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

  if (rentRows.length === 0) throw new Error("Rent not found");
  const rent = rentRows[0]!;

  const isSeller = rent.seller_id === user_id;
  const isOwner = rent.owner_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isSeller && !isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to delete this rent");
  }

  // Check for inventory in this warehouse by this seller
  const [inventoryRows] = await pool.query<RowDataPacket[]>(
    `SELECT inventory_id FROM inventory 
     WHERE warehouse_id = ? AND product_id IN (SELECT product_id FROM products WHERE seller_id = ?)
     AND quantity > 0`,
    [rent.warehouse_id, rent.seller_id]
  );

  if (inventoryRows.length > 0) {
    throw new Error("Cannot delete rent: inventory still exists in this warehouse. Remove inventory first.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM rents WHERE rent_id = ?`,
    [rent_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No rent found to delete");
  }

  // Free up warehouse if no other active rents
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