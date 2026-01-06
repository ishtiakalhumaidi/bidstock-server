import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addWarehouse = async (payload: Record<string, unknown>) => {
  const { owner_id, location, capacity, price } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO warehouses(owner_id, location, capacity, price) VALUES(?,?,?,?)`,
    [owner_id, location, capacity, price]
  );
  return result.insertId;
};

const getWarehouses = async () => {
  await pool.query(`
    UPDATE rents r
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    SET r.status = 'completed', w.status = 'available'
    WHERE r.status = 'active' AND r.end_date < NOW()
  `);


  const result = await pool.query(`SELECT * FROM warehouses ORDER BY status ASC`);
  return result;
};

const getMyWarehouses = async (owner_id: string) => {

  await pool.query(`
    UPDATE rents r
    JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    SET r.status = 'completed', w.status = 'available'
    WHERE r.status = 'active' AND r.end_date < NOW()
  `);


  const [result] = await pool.query(`
    SELECT 
      w.*,
      COALESCE(SUM(p.size * i.quantity), 0) as used_capacity
    FROM warehouses w
    LEFT JOIN rents r ON w.warehouse_id = r.warehouse_id AND r.status = 'active'
    LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
    LEFT JOIN products p ON i.product_id = p.product_id
    WHERE w.owner_id = ?
    GROUP BY w.warehouse_id
  `, [owner_id]);
  return result;
};

const getSingleWarehouse = async (id: string) => {
  const result = await pool.query(
    `SELECT * FROM warehouses WHERE warehouse_id=?`,
    [id]
  );
  return result;
};

const updateWarehouse = async (
  payload: Record<string, unknown>,
  id: string
) => {
  const { location, capacity, price, status } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE warehouses SET location=?, capacity=?, price=?, status=? WHERE warehouse_id=?`,
    [location, capacity, price, status, id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no warehouse found to update");
  }

  return result;
};

const deleteWarehouse = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM warehouses WHERE warehouse_id=?`,
    [id]
  );
  if (result.affectedRows === 0) {
    throw new Error("no warehouse found to delete");
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