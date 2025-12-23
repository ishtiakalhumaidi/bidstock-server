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
  const [result] = await pool.query(`
    SELECT 
      b.*,
      p.name as product_name,
      p.image_url,
      p.price as base_price,
      p.description,
      u.name as seller_name,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id) as highest_bid
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    WHERE b.status = 'open'
    ORDER BY b.end_time ASC
  `);
  return result;
};

const getSingleBid = async (id: string) => {
  const [result] = await pool.query(
    `
    SELECT 
      b.*,
      p.name as product_name,
      p.image_url,
      p.description,
      p.price as base_price,
      u.name as seller_name,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id) as highest_bid
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    WHERE b.bid_id=?`,
    [id]
  );
  return result;
};

const getMyBids = async (seller_id: string) => {
  const [result] = await pool.query(`
    SELECT 
      b.*,
      p.name as product_name,
      p.image_url,
      p.price as base_price,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id) as offer_count,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id) as highest_bid
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    WHERE b.seller_id = ?
    ORDER BY b.bid_id DESC  -- Changed from created_at to bid_id
  `, [seller_id]);
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

export const bidsService = {
  addBid,
  getBids,
  getSingleBid,
  updateBid,
  deleteBid,
  getMyBids,
};
