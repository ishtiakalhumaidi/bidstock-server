import type { ResultSetHeader, RowDataPacket } from "mysql2";
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

const getBidOffers = async (bid_id: string) => {
  const [result] = await pool.query(`
    SELECT 
      o.*,
      u.name as buyer_name,
      u.email as buyer_email,
      u.user_image as buyer_image
    FROM offers o
    JOIN users u ON o.buyer_id = u.user_id
    WHERE o.bid_id = ?
    ORDER BY o.offered_price DESC
  `, [bid_id]);
  return result;
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

const acceptOffer = async (offer_id: string, seller_id: string) => {
  const [offerRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM offers WHERE offer_id = ?`, 
    [offer_id]
  );
  if (offerRows.length === 0) throw new Error("Offer not found");
  const offer : any= offerRows[0];
  const [bidRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM bids WHERE bid_id = ?`, 
    [offer.bid_id]
  );
  if (bidRows.length === 0) throw new Error("Bid not found");
  const bid : any = bidRows[0];

  if (String(bid.seller_id) !== String(seller_id)) {
    throw new Error("Unauthorized: You do not own this auction");
  }

  if (bid.status !== 'open') {
    throw new Error("Auction is already closed or completed");
  }

  await pool.query(`UPDATE offers SET status = 'accepted' WHERE offer_id = ?`, [offer_id]);

  await pool.query(`UPDATE offers SET status = 'rejected' WHERE bid_id = ? AND offer_id != ?`, [bid.bid_id, offer_id]);

  await pool.query(`UPDATE bids SET status = 'closed', end_time = NOW() WHERE bid_id = ?`, [bid.bid_id]);

  const [txResult] = await pool.query<ResultSetHeader>(
    `INSERT INTO transactions(
      bid_id,
      from_role, from_id,
      to_role, to_id,
      transaction_type,
      amount,
      status,
      payment_method,
      reference_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bid.bid_id,
      'buyer', offer.buyer_id,
      'seller', seller_id,
      'payment',
      offer.offered_price,
      'pending', 
      'wallet',
      `BID-${bid.bid_id}-OFFER-${offer_id}`
    ]
  );

  return txResult.insertId;
};

export const offersService = {
  addOffer,
  getOffers,
  getSingleOffer,
  updateOffer,
  deleteOffer,
  getBidOffers,acceptOffer
};
