import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addRent = async (payload: Record<string, unknown>) => {
  const { seller_id, warehouse_id, start_date, end_date } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO rents(
      seller_id,
      warehouse_id,
      start_date,
      end_date
    ) VALUES (?,?,?,?)`,
    [seller_id, warehouse_id, start_date, end_date ?? null]
  );

  return result.insertId;
};

const getRents = async () => {
  const result = await pool.query(`SELECT * FROM rents`);
  return result;
};

const getSingleRent = async (rent_id: string) => {
  const result = await pool.query(
    `SELECT * FROM rents WHERE rent_id=?`,
    [rent_id]
  );
  return result;
};

/**
 * seller can see their own rents
 */
const getMyRents = async (seller_id: string) => {
  const result = await pool.query(
    `SELECT * FROM rents WHERE seller_id=? ORDER BY start_date DESC`,
    [seller_id]
  );
  return result;
};

const updateRent = async (
  payload: Record<string, unknown>,
  rent_id: string
) => {
  const { start_date, end_date, status } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE rents 
     SET start_date=?, end_date=?, status=? 
     WHERE rent_id=?`,
    [start_date, end_date, status, rent_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no rent found to update");
  }

  return result;
};

const deleteRent = async (rent_id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM rents WHERE rent_id=?`,
    [rent_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no rent found to delete");
  }

  return result;
};

export const rentService = {
  addRent,
  getRents,
  getSingleRent,
  getMyRents,
  updateRent,
  deleteRent,
};
