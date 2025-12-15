import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addInventory = async (payload: Record<string, unknown>) => {
  const { product_id, warehouse_id, stock_level, quantity } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory(product_id, warehouse_id, stock_level, quantity)
     VALUES(?,?,?,?)`,
    [product_id, warehouse_id, stock_level ?? 0, quantity ?? 0]
  );

  return result;
};

const getInventories = async () => {
  const result = await pool.query(`SELECT * FROM inventory`);
  return result;
};

const getSingleInventory = async (
  product_id: string,
  warehouse_id: string
) => {
  const result = await pool.query(
    `SELECT * FROM inventory WHERE product_id=? AND warehouse_id=?`,
    [product_id, warehouse_id]
  );
  return result;
};

const updateInventory = async (
  payload: Record<string, unknown>,
  product_id: string,
  warehouse_id: string
) => {
  const { stock_level, quantity } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE inventory 
     SET stock_level=?, quantity=? 
     WHERE product_id=? AND warehouse_id=?`,
    [stock_level, quantity, product_id, warehouse_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no inventory found to update");
  }

  return result;
};

const deleteInventory = async (
  product_id: string,
  warehouse_id: string
) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM inventory WHERE product_id=? AND warehouse_id=?`,
    [product_id, warehouse_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no inventory found to delete");
  }

  return result;
};

export const inventoryService = {
  addInventory,
  getInventories,
  getSingleInventory,
  updateInventory,
  deleteInventory,
};
