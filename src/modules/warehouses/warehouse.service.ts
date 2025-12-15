import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addWarehouse = async (payload: Record<string, unknown>) => {
  const { owner_id, location, capacity } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO warehouses(owner_id, location, capacity) VALUES(?,?,?)`,
    [owner_id, location, capacity]
  );
  return result.insertId;
};

const getWarehouses = async () => {
  const result = await pool.query(`SELECT * FROM warehouses`);
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
  const { owner_id, location, capacity, booked } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE warehouses SET location=?,capacity=?, booked=? WHERE warehouse_id=?`,
    [location, capacity, Number(capacity) - Number(booked), id]
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
  updateWarehouse,
  deleteWarehouse,
};
