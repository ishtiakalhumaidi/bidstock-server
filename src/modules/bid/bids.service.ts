import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addBid = async (payload: Record<string, unknown>) => {
  const {
    buyer_id,
    product_id,
    offered_price,
    status,
    is_suspicious,
    flag_reason,
    end_time,
  } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO bids(
      buyer_id,
      product_id,
      offered_price,
      status,
      is_suspicious,
      flag_reason,
      end_time
    ) VALUES (?,?,?,?,?,?,?)`,
    [
      buyer_id,
      product_id,
      offered_price,
      status ?? "pending",
      is_suspicious ?? false,
      flag_reason ?? null,
      end_time ?? null,
    ]
  );

  return result.insertId;
};

const getBids = async () => {
  const result = await pool.query(`SELECT * FROM bids`);
  return result;
};

const getSingleBid = async (id: string) => {
  const result = await pool.query(
    `SELECT * FROM bids WHERE bid_id=?`,
    [id]
  );
  return result;
};

const updateBid = async (
  payload: Record<string, unknown>,
  id: string
) => {
  const { offered_price, status, is_suspicious, flag_reason, end_time } =
    payload;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE bids 
     SET offered_price=?, status=?, is_suspicious=?, flag_reason=?, end_time=? 
     WHERE bid_id=?`,
    [
      offered_price,
      status,
      is_suspicious,
      flag_reason,
      end_time,
      id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error("no bid found to update");
  }

  return result;
};

const deleteBid = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM bids WHERE bid_id=?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no bid found to delete");
  }

  return result;
};

export const bidsService = {
  addBid,
  getBids,
  getSingleBid,
  updateBid,
  deleteBid,
};
