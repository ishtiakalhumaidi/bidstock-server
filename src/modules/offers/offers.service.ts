import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addOffer = async (payload: Record<string, unknown>) => {
  const {
    bid_id,
    buyer_id,
    offered_price,
    status,
    is_suspicious,
    flag_reason,
  } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO offers (bid_id, buyer_id, offered_price, status, is_suspicious, flag_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      bid_id,
      buyer_id,
      offered_price,
      status ?? "pending",
      is_suspicious ?? false,
      flag_reason ?? null,
    ]
  );

  return result.insertId;
};

const getOffers = async () => {
  const [result] = await pool.query(`SELECT * FROM offers`);
  return result;
};

const getSingleOffer = async (id: string) => {
  const [result] = await pool.query(`SELECT * FROM offers WHERE offer_id=?`, [
    id,
  ]);
  return result;
};

const updateOffer = async (payload: Record<string, unknown>, id: string) => {
  const { offered_price, status, is_suspicious, flag_reason } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE offers SET offered_price=?, status=?, is_suspicious=?, flag_reason=? WHERE offer_id=?`,
    [offered_price, status, is_suspicious, flag_reason, id]
  );

  if (result.affectedRows === 0) throw new Error("No offer found to update");
  return result;
};

const deleteOffer = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM offers WHERE offer_id=?`,
    [id]
  );

  if (result.affectedRows === 0) throw new Error("No offer found to delete");
  return result;
};

export const offersService = {
  addOffer,
  getOffers,
  getSingleOffer,
  updateOffer,
  deleteOffer,
};
