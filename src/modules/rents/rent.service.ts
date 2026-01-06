import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addRent = async (payload: Record<string, unknown>) => {
  const { seller_id, warehouse_id, start_date, end_date } = payload;

  const [sellerCheck] = await pool.query(
    `SELECT user_id FROM sellers WHERE user_id = ?`,
    [seller_id]
  );

  if ((sellerCheck as any[]).length === 0) {
    throw new Error("Seller not found");
  }

  const [warehouseCheck] = await pool.query(
    `SELECT warehouse_id, capacity, status FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  if ((warehouseCheck as any[]).length === 0) {
    throw new Error("Warehouse not found");
  }

  const warehouse = (warehouseCheck as any[])[0];

  if (warehouse.status === 'booked') {
    throw new Error("Warehouse is already fully booked");
  }
  
  if (warehouse.status === 'maintenance') {
    throw new Error("Warehouse is currently under maintenance");
  }

  const [overlapCheck] = await pool.query(
    `SELECT rent_id FROM rents 
     WHERE warehouse_id = ? 
     AND status = 'active'
     AND (
       (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
       OR (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
       OR (start_date >= ? AND start_date <= ?)
     )`,
    [
      warehouse_id,
      start_date, start_date,
      end_date || '9999-12-31', end_date || '9999-12-31',
      start_date, end_date || '9999-12-31'
    ]
  );

  if ((overlapCheck as any[]).length > 0) {
    throw new Error("Warehouse is already rented for this period");
  }


  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO rents(
      seller_id,
      warehouse_id,
      start_date,
      end_date,
      status
    ) VALUES (?,?,?,?,?)`,
    [seller_id, warehouse_id, start_date, end_date ?? null, 'active']
  );

  await pool.query(
    `UPDATE warehouses SET status = 'booked' WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  return result.insertId;
};

const getRents = async () => {
  const result = await pool.query(`
    SELECT 
      r.*,
      u.name as seller_name,
      u.email as seller_email,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    ORDER BY r.created_at DESC
  `);
  return result;
};

const getSingleRent = async (rent_id: string) => {
  const result = await pool.query(
    `SELECT 
      r.*,
      u.name as seller_name,
      u.email as seller_email,
      u.phone as seller_phone,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    WHERE r.rent_id=?`,
    [rent_id]
  );
  return result;
};

const getMyRents = async (seller_id: string) => {
  const result = await pool.query(
    `SELECT 
      r.*,
      w.location as warehouse_location,
      w.capacity as warehouse_capacity,
      wo.user_id as owner_id,
      u.name as owner_name,
      u.email as owner_email,
      u.phone as owner_phone
    FROM rents r
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    JOIN warehouse_owners wo ON w.owner_id = wo.user_id
    JOIN users u ON wo.user_id = u.user_id
    WHERE r.seller_id=? 
    ORDER BY r.start_date DESC`,
    [seller_id]
  );
  return result;
};

const getWarehouseRents = async (warehouse_id: string) => {
  const result = await pool.query(
    `SELECT 
      r.*,
      u.name as seller_name,
      u.email as seller_email,
      u.phone as seller_phone
    FROM rents r
    JOIN sellers s ON r.seller_id = s.user_id
    JOIN users u ON s.user_id = u.user_id
    WHERE r.warehouse_id=? 
    ORDER BY r.start_date DESC`,
    [warehouse_id]
  );
  return result;
};

const updateRent = async (
  payload: Record<string, unknown>,
  rent_id: string
) => {
  const { start_date, end_date, status } = payload;

  if (start_date || end_date) {
    const [rentCheck] = await pool.query(
      `SELECT warehouse_id, seller_id FROM rents WHERE rent_id = ?`,
      [rent_id]
    );

    if ((rentCheck as any[]).length === 0) {
      throw new Error("Rent not found");
    }

    const { warehouse_id, seller_id } = (rentCheck as any[])[0];

    const [overlapCheck] = await pool.query(
      `SELECT rent_id FROM rents 
       WHERE warehouse_id = ? 
       AND seller_id = ?
       AND rent_id != ?
       AND status = 'active'
       AND (
         (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
         OR (start_date <= ? AND (end_date IS NULL OR end_date >= ?))
         OR (start_date >= ? AND start_date <= ?)
       )`,
      [
        warehouse_id,
        seller_id,
        rent_id,
        start_date, start_date,
        end_date || '9999-12-31', end_date || '9999-12-31',
        start_date, end_date || '9999-12-31'
      ]
    );

    if ((overlapCheck as any[]).length > 0) {
      throw new Error("Updated dates conflict with existing rent");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE rents 
     SET start_date=?, end_date=?, status=? 
     WHERE rent_id=?`,
    [start_date, end_date, status, rent_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no rent found to update");
  }
  
  if (status === 'completed' || status === 'cancelled') {
      const [rentData] = await pool.query(`SELECT warehouse_id FROM rents WHERE rent_id=?`, [rent_id]);
      if((rentData as any[]).length > 0) {
          await pool.query(`UPDATE warehouses SET status='available' WHERE warehouse_id=?`, [(rentData as any[])[0].warehouse_id]);
      }
  }

  return result;
};

const deleteRent = async (rent_id: string) => {
  const [rentData] = await pool.query(
    `SELECT warehouse_id FROM rents WHERE rent_id = ?`, 
    [rent_id]
  );
  
  if ((rentData as any[]).length === 0) {
      throw new Error("Rent not found");
  }
  const { warehouse_id } = (rentData as any[])[0];

  const [inventoryCheck] = await pool.query(
    `SELECT i.inventory_id 
     FROM inventory i
     JOIN rents r ON i.warehouse_id = r.warehouse_id
     JOIN products p ON i.product_id = p.product_id
     WHERE r.rent_id = ? AND p.seller_id = r.seller_id`,
    [rent_id]
  );

  if ((inventoryCheck as any[]).length > 0) {
    throw new Error("Cannot delete rent: inventory exists for this warehouse. Please remove inventory first.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM rents WHERE rent_id=?`,
    [rent_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no rent found to delete");
  }

  await pool.query(
    `UPDATE warehouses SET status = 'available' WHERE warehouse_id = ?`,
    [warehouse_id]
  );

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