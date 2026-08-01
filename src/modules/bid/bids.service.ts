import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

// Interfaces for Payloads
export interface AddBidPayload {
  product_id: number;
  end_time?: string | Date | null;
  starting_bid?: number | string;
}

export interface UpdateBidPayload {
  end_time?: string | Date | null;
  status?: "open" | "closed";
}

export interface BidRow extends RowDataPacket {
  bid_id: number;
  product_id: number;
  seller_id: number;
  starting_bid: number;
  status: "open" | "closed";
  end_time: Date;
  created_at?: Date;
  // Joined fields from SELECT queries
  product_name?: string;
  image_url?: string | null;
  description?: string | null;
  base_price?: number;
  seller_name?: string;
  highest_bid?: number | null;
  pending_offers?: number;
  offer_count?: number;
}

export interface ProductRow extends RowDataPacket {
  product_id: number;
  seller_id: number;
  price: number;
}

interface CountRow extends RowDataPacket {
  count: number;
}

const addBid = async (payload: AddBidPayload, seller_id: number) => {
  const { product_id, end_time, starting_bid } = payload;

  if (!product_id) {
    throw new Error("product_id is required");
  }

  // Verify product exists and belongs to this seller
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT product_id, seller_id, price FROM products WHERE product_id = ? AND status = 'active'`,
    [product_id]
  );

  const product = productRows[0];
  if (!product) {
    throw new Error("Product not found or inactive");
  }

  if (product.seller_id !== seller_id) {
    throw new Error("Unauthorized: You do not own this product");
  }

  // Check if product already has an active bid
  const [existingBid] = await pool.query<BidRow[]>(
    `SELECT bid_id FROM bids WHERE product_id = ? AND status = 'open'`,
    [product_id]
  );
  if (existingBid.length > 0) {
    throw new Error("This product already has an active auction");
  }

  // Validate end_time is in the future
  if (end_time) {
    const endDate = new Date(end_time);
    if (endDate <= new Date()) {
      throw new Error("Auction end time must be in the future");
    }
  }

  const startPrice = starting_bid ? Number(starting_bid) : product.price;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO bids (product_id, seller_id, starting_bid, end_time) VALUES (?, ?, ?, ?)`,
    [product_id, seller_id, startPrice, end_time ?? null]
  );

  return result.insertId;
};

const getBids = async () => {
  // Auto-close expired auctions
  await pool.query(
    `UPDATE bids SET status = 'closed' WHERE end_time < NOW() AND status = 'open'`
  );

  const [result] = await pool.query<BidRow[]>(`
    SELECT
      b.*,
      p.name as product_name,
      p.image_url,
      b.starting_bid as base_price,
      p.description,
      u.name as seller_name,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id AND status != 'rejected') as highest_bid,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id AND status = 'pending') as pending_offers
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    WHERE b.status = 'open'
    ORDER BY b.end_time ASC
  `);
  return result;
};

const getSingleBid = async (id: string) => {
  // Auto-close if expired
  await pool.query(
    `UPDATE bids SET status = 'closed' WHERE bid_id = ? AND end_time < NOW() AND status = 'open'`,
    [id]
  );

  const [result] = await pool.query<BidRow[]>(
    `
    SELECT
      b.*,
      p.name as product_name,
      p.image_url,
      p.description,
      b.starting_bid as base_price,
      u.name as seller_name,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id AND status != 'rejected') as highest_bid,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id AND status = 'pending') as pending_offers
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    WHERE b.bid_id=?`,
    [id]
  );

  return result[0] ?? null;
};

const getMyBids = async (seller_id: string | number) => {
  const [result] = await pool.query<BidRow[]>(`
    SELECT 
      b.*,
      p.name as product_name,
      p.image_url,
      b.starting_bid as base_price,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id) as offer_count,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id AND status != 'rejected') as highest_bid
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    WHERE b.seller_id = ?
    ORDER BY b.created_at DESC
  `, [seller_id]);
  return result;
};

const updateBid = async (payload: UpdateBidPayload, id: string, seller_id: number) => {
  // Verify ownership first
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT * FROM bids WHERE bid_id = ?`,
    [id]
  );

  const bid = bidRows[0];
  if (!bid) {
    throw new Error("Bid not found");
  }

  if (bid.seller_id !== seller_id) {
    throw new Error("Unauthorized: You do not own this auction");
  }

  if (bid.status === "closed") {
    throw new Error("Cannot update a closed auction");
  }

  const { end_time, status } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE bids SET end_time=?, status=? WHERE bid_id=?`,
    [end_time ?? bid.end_time, status ?? bid.status, id]
  );

  if (result.affectedRows === 0) throw new Error("No bid found to update");
  return result;
};

const deleteBid = async (id: string, seller_id: number) => {
  // Verify ownership
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT * FROM bids WHERE bid_id = ?`,
    [id]
  );

  const bid = bidRows[0];
  if (!bid) {
    throw new Error("Bid not found");
  }

  if (bid.seller_id !== seller_id) {
    throw new Error("Unauthorized: You do not own this auction");
  }

  // Check for pending offers
  const [offerRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM offers WHERE bid_id = ? AND status = 'pending'`,
    [id]
  );

  const countRow = offerRows[0];
  if (countRow && countRow.count > 0) {
    throw new Error("Cannot delete: This auction has pending offers. Close it first or reject all offers.");
  }

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