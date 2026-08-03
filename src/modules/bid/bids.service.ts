// bids.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { inventoryService } from "../inventory/inventory.service";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

export interface AddBidPayload {
  product_id: number;
  end_time?: string | Date | null;
  starting_bid?: number | string;
  quantity?: number | string;
}

export interface UpdateBidPayload {
  end_time?: string | Date | null;
  status?: "open" | "closed";
}

export interface GetBidsQuery {
  page?: number | string;
  limit?: number | string;
  category?: string;
  min_price?: number | string;
  max_price?: number | string;
  seller_id?: number | string;
  sort?: "ending_soon" | "newest" | "highest_bid";
}

export interface BidRow extends RowDataPacket {
  bid_id: number;
  product_id: number;
  seller_id: number;
  starting_bid: number;
  status: "open" | "closed";
  quantity: number;
  end_time: Date;
  created_at?: Date;
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

// ---- Helpers -----------------------------------------------------------

const toMySQLDate = (value: string | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    throw  BadRequest("Invalid date format for end_time");
  }
  return date;
};

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

const autoCloseEmptyBids = async () => {
  const [openBids] = await pool.query<RowDataPacket[]>(
    `SELECT b.bid_id, b.product_id, b.seller_id
     FROM bids b
     WHERE b.status = 'open'`,
  );

  for (const bid of openBids) {
    const available = await inventoryService.getAvailableStock(bid.product_id, bid.seller_id);
    if (available <= 0) {
      await closeBidAndRejectOffers(bid.bid_id);
    }
  }
};

const closeBidAndRejectOffers = async (bid_id: number) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Find all pending offers to notify the buyers before we reject them
    const [pendingOffers] = await connection.query<RowDataPacket[]>(
      `SELECT buyer_id FROM offers WHERE bid_id = ? AND status = 'pending'`,
      [bid_id]
    );

    await connection.query(`UPDATE bids SET status = 'closed' WHERE bid_id = ? AND status = 'open'`, [bid_id]);
    
    await connection.query(
      `UPDATE offers SET status = 'rejected', flag_reason = 'Auction auto-closed: seller inventory depleted'
        WHERE bid_id = ? AND status = 'pending'`,
      [bid_id],
    );

    // Notify the buyers that their offers were automatically rejected
    if (pendingOffers.length > 0) {
      const notificationValues = pendingOffers.map((offer) => [
        offer.buyer_id,
        'bid_update',
        `Your pending offer on auction #${bid_id} was cancelled because the seller's inventory was depleted.`,
        'bid',
        bid_id
      ]);

      await connection.query(
        `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id) VALUES ?`,
        [notificationValues]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("closeBidAndRejectOffers failed for bid_id", bid_id, error);
  } finally {
    connection.release();
  }
};

const closeEmptyBidsForProduct = async (product_id: number | string, seller_id: number | string) => {
  const available = await inventoryService.getAvailableStock(product_id, seller_id);
  if (available > 0) return;

  const [openBids] = await pool.query<RowDataPacket[]>(
    `SELECT bid_id FROM bids WHERE product_id = ? AND seller_id = ? AND status = 'open'`,
    [product_id, seller_id],
  );

  for (const bid of openBids) {
    await closeBidAndRejectOffers(bid.bid_id);
  }
};

// ---- Service methods -----------------------------------------------------

const addBid = async (payload: AddBidPayload, seller_id: number) => {
  const { product_id, end_time, starting_bid, quantity } = payload;

  if (!product_id) {
    throw BadRequest("product_id is required");
  }

  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT product_id, seller_id, price FROM products WHERE product_id = ? AND status = 'active'`,
    [product_id],
  );
  const product = productRows[0];

  if (!product) {
    throw NotFound("Product not found or inactive");
  }

  if (product.seller_id !== seller_id) {
    throw Forbidden("Unauthorized: You do not own this product");
  }

  const requestedQty = quantity !== undefined ? parseInt(String(quantity), 10) : 1;
  if (isNaN(requestedQty) || requestedQty <= 0) {
    throw BadRequest("Quantity must be a positive whole number");
  }

  const available = await inventoryService.getAvailableStock(product_id, seller_id);
  if (available <= 0) {
    throw BadRequest(
      "Cannot create auction: no available inventory for this product. Add inventory to an actively-rented warehouse first.",
    );
  }

  if (requestedQty > available) {
    throw BadRequest(
      `Cannot create auction for ${requestedQty} units: only ${available} available in actively-rented warehouses.`,
    );
  }

  const [existingBid] = await pool.query<BidRow[]>(
    `SELECT bid_id FROM bids WHERE product_id = ? AND status = 'open'`,
    [product_id],
  );

  if (existingBid.length > 0) {
    throw BadRequest("This product already has an active auction");
  }

  const endTimeDate = toMySQLDate(end_time);
  if (endTimeDate && endTimeDate <= new Date()) {
    throw BadRequest("Auction end time must be in the future");
  }

  const startPrice = starting_bid ? Number(starting_bid) : product.price;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO bids (product_id, seller_id, starting_bid, quantity, end_time) VALUES (?, ?, ?, ?, ?)`,
    [product_id, seller_id, startPrice, requestedQty, endTimeDate],
  );

  return result.insertId;
};

const getBids = async (query: GetBidsQuery = {}) => {
  await pool.query(`UPDATE bids SET status = 'closed' WHERE end_time < NOW() AND status = 'open'`);
  await autoCloseEmptyBids();

  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [`b.status = 'open'`];
  const params: unknown[] = [];

  if (query.category) {
    whereClauses.push(`p.category = ?`);
    params.push(query.category);
  }
  if (query.seller_id) {
    whereClauses.push(`b.seller_id = ?`);
    params.push(query.seller_id);
  }
  if (query.min_price !== undefined) {
    whereClauses.push(`b.starting_bid >= ?`);
    params.push(Number(query.min_price));
  }
  if (query.max_price !== undefined) {
    whereClauses.push(`b.starting_bid <= ?`);
    params.push(Number(query.max_price));
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  let orderBySQL = `ORDER BY b.end_time ASC`;
  if (query.sort === "newest") orderBySQL = `ORDER BY b.created_at DESC`;
  if (query.sort === "highest_bid") orderBySQL = `ORDER BY highest_bid DESC`;
  if (query.sort === "ending_soon") orderBySQL = `ORDER BY b.end_time ASC`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM bids b JOIN products p ON b.product_id = p.product_id ${whereSQL}`,
    params,
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<BidRow[]>(
    `SELECT
      b.*, p.name as product_name, p.image_url, p.category, b.starting_bid as base_price,
      p.description, u.name as seller_name,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id AND status != 'rejected') as highest_bid,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id AND status = 'pending') as pending_offers
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    ${whereSQL}
    ${orderBySQL}
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  return {
    data: rows,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
};

const getSingleBid = async (id: string) => {
  await pool.query(
    `UPDATE bids SET status = 'closed' WHERE bid_id = ? AND end_time < NOW() AND status = 'open'`,
    [id],
  );

  const [bidCheck] = await pool.query<BidRow[]>(
    `SELECT bid_id, product_id, seller_id FROM bids WHERE bid_id = ? AND status = 'open'`,
    [id],
  );

  if (bidCheck.length > 0) {
    const bid = bidCheck[0]!;
    const available = await inventoryService.getAvailableStock(bid.product_id, bid.seller_id);
    if (available <= 0) {
      await closeBidAndRejectOffers(bid.bid_id);
    }
  }

  const [result] = await pool.query<BidRow[]>(
    `SELECT
      b.*, p.name as product_name, p.image_url, p.description, b.starting_bid as base_price,
      u.name as seller_name,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id AND status != 'rejected') as highest_bid,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id AND status = 'pending') as pending_offers
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    WHERE b.bid_id=?`,
    [id],
  );

  return result[0] ?? null;
};

const getMyBids = async (
  seller_id: string | number,
  page?: number | string,
  limit?: number | string,
) => {
  await autoCloseEmptyBids();

  const { pageNum, limitNum, offset } = parsePagination(page, limit);

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM bids WHERE seller_id = ?`,
    [seller_id],
  );
  const total = countRows[0]?.count ?? 0;

  const [result] = await pool.query<BidRow[]>(
    `SELECT 
      b.*, p.name as product_name, p.image_url, b.starting_bid as base_price,
      (SELECT COUNT(*) FROM offers WHERE bid_id = b.bid_id) as offer_count,
      (SELECT MAX(offered_price) FROM offers WHERE bid_id = b.bid_id AND status != 'rejected') as highest_bid
    FROM bids b
    JOIN products p ON b.product_id = p.product_id
    WHERE b.seller_id = ?
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?`,
    [seller_id, limitNum, offset],
  );

  return {
    data: result,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  };
};

const updateBid = async (payload: UpdateBidPayload, id: string, seller_id: number) => {
  const [bidRows] = await pool.query<BidRow[]>(`SELECT * FROM bids WHERE bid_id = ?`, [id]);
  const bid = bidRows[0];

  if (!bid) {
    throw NotFound("Bid not found");
  }

  if (bid.seller_id !== seller_id) {
    throw Forbidden("Unauthorized: You do not own this auction");
  }

  if (bid.status === "closed") {
    throw BadRequest("Cannot update a closed auction");
  }

  const { end_time, status } = payload;
  const endTimeDate = end_time !== undefined ? toMySQLDate(end_time) : undefined;

  if (endTimeDate && endTimeDate <= new Date()) {
    throw BadRequest("Auction end time must be in the future");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE bids SET end_time=?, status=? WHERE bid_id=?`,
    [endTimeDate !== undefined ? endTimeDate : bid.end_time, status ?? bid.status, id],
  );

  if (result.affectedRows === 0) throw NotFound("No bid found to update");
  return result;
};

const deleteBid = async (id: string, seller_id: number) => {
  const [bidRows] = await pool.query<BidRow[]>(`SELECT * FROM bids WHERE bid_id = ?`, [id]);
  const bid = bidRows[0];

  if (!bid) {
    throw NotFound("Bid not found");
  }

  if (bid.seller_id !== seller_id) {
    throw Forbidden("Unauthorized: You do not own this auction");
  }

  const [offerRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM offers WHERE bid_id = ? AND status = 'pending'`,
    [id],
  );
  const countRow = offerRows[0];

  if (countRow && countRow.count > 0) {
    throw BadRequest("Cannot delete: This auction has pending offers. Close it first or reject all offers.");
  }

  const [result] = await pool.query<ResultSetHeader>(`DELETE FROM bids WHERE bid_id=?`, [id]);
  if (result.affectedRows === 0) throw NotFound("No bid found to delete");

  return result;
};

export const bidsService = {
  addBid,
  getBids,
  getSingleBid,
  updateBid,
  deleteBid,
  getMyBids,
  closeEmptyBidsForProduct,
};