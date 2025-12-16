import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addBid = async (payload: Record<string, unknown>) => {
  const { product_id, seller_id, start_time, end_time } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO bids (product_id, seller_id, start_time, end_time) VALUES (?,?,?,?)`,
    [product_id, seller_id, start_time ?? null, end_time ?? null]
  );

  return result.insertId;
};

const getBids = async () => {
  const [result] = await pool.query(`SELECT * FROM bids`);
  return result;
};

const getSingleBid = async (id: string) => {
  const result = await pool.query(`SELECT * FROM bids WHERE bid_id=?`, [id]);
  return result;
};

const updateBid = async (payload: Record<string, unknown>, id: string) => {
  const { start_time, end_time, status } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE bids SET start_time=?, end_time=?, status=? WHERE bid_id=?`,
    [start_time, end_time, status, id]
  );

  if (result.affectedRows === 0) throw new Error("No bid found to update");
  return result;
};

const deleteBid = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM bids WHERE bid_id=?`,
    [id]
  );

  if (result.affectedRows === 0) throw new Error("No bid found to delete");
  return result;
};

export const bidsService = { addBid, getBids, getSingleBid, updateBid, deleteBid };
