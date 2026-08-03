// offers.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

interface BidRow extends RowDataPacket {
  bid_id: number;
  seller_id: number;
  product_id: number;
  starting_bid: number;
  base_price?: number;
  status: string;
  end_time: Date | null;
}

interface OfferRow extends RowDataPacket {
  offer_id: number;
  bid_id: number;
  buyer_id: number;
  seller_id: number;
  offered_price: number;
  status: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetOffersQuery {
  page?: number | string;
  limit?: number | string;
  status?: "pending" | "accepted" | "rejected";
  bid_id?: number | string;
  buyer_id?: number | string;
}

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

// ---- Service methods -----------------------------------------------------

const addOffer = async (payload: Record<string, unknown>) => {
  const {
    bid_id,
    buyer_id,
    offered_price,
    quantity,
    status,
    is_suspicious,
    flag_reason,
  } = payload;

  if (!bid_id || !buyer_id || !offered_price) {
    throw BadRequest("bid_id, buyer_id, and offered_price are required");
  }

  // 1. WE ALREADY FETCH THE SELLER ID AND PRODUCT NAME HERE
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT b.*, p.name as product_name
      FROM bids b
     JOIN products p ON b.product_id = p.product_id
     WHERE b.bid_id = ?`,
    [bid_id]
  );

  if (bidRows.length === 0) throw NotFound("Auction not found");

  const bid = bidRows[0]!; // We will reuse this object for the notification!

  if (bid.status !== 'open') {
    throw BadRequest("This auction is closed");
  }

  if (bid.end_time && new Date(bid.end_time) < new Date()) {
    throw BadRequest("This auction has expired");
  }

  if (String(bid.seller_id) === String(buyer_id)) {
    throw BadRequest("You cannot bid on your own auction");
  }

  const offerQty = quantity !== undefined ? parseInt(String(quantity), 10) : 1;
  if (isNaN(offerQty) || offerQty <= 0) {
    throw BadRequest("Quantity must be a positive whole number");
  }

  if (offerQty > (bid.quantity ?? 1)) {
    throw BadRequest(`Offer quantity cannot exceed the auction's available quantity (${bid.quantity})`);
  }

  const offerPrice = parseFloat(offered_price as string);
  const basePrice = parseFloat(String(bid.starting_bid ?? bid.base_price ?? 0));

  if (isNaN(offerPrice) || offerPrice <= 0) throw BadRequest("Invalid offer price");
  if (offerPrice <= basePrice) throw BadRequest(`Offer must be higher than base price ($${basePrice})`);

  const [highestRows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(offered_price) as highest FROM offers WHERE bid_id = ? AND status != 'rejected'`,
    [bid_id]
  );

  const currentHighest = parseFloat(String(highestRows[0]?.highest)) || 0;
  if (currentHighest > 0 && offerPrice <= currentHighest) {
    throw BadRequest(`Offer must be higher than current highest bid ($${currentHighest})`);
  }

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM offers WHERE bid_id = ? AND buyer_id = ? AND status = 'pending'`,
    [bid_id, buyer_id]
  );

  if (existingRows.length > 0) {
    throw BadRequest("You already have a pending offer on this auction");
  }

  // 2. Insert the offer
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO offers (bid_id, buyer_id, offered_price, quantity, status, is_suspicious, flag_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      bid_id,
      buyer_id,
      offered_price,
      offerQty,
      status ?? "pending",
      is_suspicious ?? false,
      flag_reason ?? null,
    ]
  );

  const newOfferId = result.insertId;

  // 3. Fire the real-time notification using the 'bid' object from Step 1!
  await pool.query(
    `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      bid.seller_id,
      'system',
      `A new market offer of $${Number(offered_price).toLocaleString()} has been placed on your auction for ${bid.product_name}.`,
      'bid',
      bid_id
    ]
  );

  return newOfferId;
};

const getOffers = async (user_role: string, query: GetOffersQuery = {}) => {
  if (user_role !== 'admin') {
    throw Forbidden("Forbidden: Admin access required");
  }

  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    whereClauses.push(`o.status = ?`);
    params.push(query.status);
  }
  if (query.bid_id) {
    whereClauses.push(`o.bid_id = ?`);
    params.push(query.bid_id);
  }
  if (query.buyer_id) {
    whereClauses.push(`o.buyer_id = ?`);
    params.push(query.buyer_id);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM offers o ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.*, b.seller_id, p.name as product_name, u.name as buyer_name
     FROM offers o
     JOIN bids b ON o.bid_id = b.bid_id
     JOIN products p ON b.product_id = p.product_id
     JOIN users u ON o.buyer_id = u.user_id
     ${whereSQL}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const getSingleOffer = async (id: string, user_id: number, user_role: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.*, b.seller_id, b.bid_id, b.product_id, p.name as product_name
     FROM offers o
     JOIN bids b ON o.bid_id = b.bid_id
     JOIN products p ON b.product_id = p.product_id
     WHERE o.offer_id = ?`,
    [id]
  );

  if (rows.length === 0) throw NotFound("Offer not found");
  
  const offer = rows[0]!;
  const isBuyer = offer.buyer_id === user_id;
  const isSeller = offer.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isBuyer && !isSeller && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to view this offer");
  }

  return offer;
};

const getBidOffers = async (
  bid_id: string,
  user_id: number,
  user_role: string,
  page?: number | string,
  limit?: number | string
) => {
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT seller_id FROM bids WHERE bid_id = ?`, [bid_id]
  );

  if (bidRows.length === 0) throw NotFound("Bid not found");

  const isSeller = bidRows[0]!.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (user_role === 'seller' && !isSeller) {
    throw Forbidden("Unauthorized: You do not own this auction");
  }

  if (user_role === 'buyer') {
    const [ownOfferRows] = await pool.query<RowDataPacket[]>(
      `SELECT offer_id FROM offers WHERE bid_id = ? AND buyer_id = ? LIMIT 1`,
      [bid_id, user_id]
    );
    if (ownOfferRows.length === 0) {
      throw Forbidden("Forbidden: You do not have an offer on this auction");
    }
  }

  if (!isSeller && !isAdmin && user_role !== 'buyer') {
    throw Forbidden("Forbidden: You do not have permission to view these offers");
  }

  const { pageNum, limitNum, offset } = parsePagination(page, limit);

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM offers WHERE bid_id = ?`,
    [bid_id]
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       o.*,
      u.name as buyer_name,
      u.email as buyer_email,
      u.user_image as buyer_image
    FROM offers o
    JOIN users u ON o.buyer_id = u.user_id
    WHERE o.bid_id = ?
    ORDER BY o.offered_price DESC
    LIMIT ? OFFSET ?`,
    [bid_id, limitNum, offset]
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const updateOffer = async (payload: Record<string, unknown>, id: string, user_id: number) => {
  const [offerRows] = await pool.query<OfferRow[]>(
    `SELECT * FROM offers WHERE offer_id = ?`, [id]
  );

  if (offerRows.length === 0) throw NotFound("Offer not found");
  
  const offer = offerRows[0]!;

  if (offer.buyer_id !== user_id) {
    throw Forbidden("Forbidden: You can only update your own offers");
  }

  if (offer.status !== 'pending') {
    throw BadRequest("Cannot update a non-pending offer");
  }

  const { offered_price } = payload;

  if (offered_price !== undefined) {
    const price = parseFloat(offered_price as string);
    if (isNaN(price) || price <= 0) {
      throw BadRequest("Invalid offer price");
    }

    const [bidRows] = await pool.query<BidRow[]>(
      `SELECT * FROM bids WHERE bid_id = ?`, [offer.bid_id]
    );
    if (bidRows.length === 0) throw NotFound("Auction not found");
    
    const bid = bidRows[0]!;
    
    if (bid.status !== 'open') {
      throw BadRequest("Cannot update offer: this auction is closed");
    }
    if (bid.end_time && new Date(bid.end_time) < new Date()) {
      throw BadRequest("Cannot update offer: this auction has expired");
    }

    const basePrice = parseFloat(String(bid.starting_bid ?? bid.base_price ?? 0));
    if (price <= basePrice) {
      throw BadRequest(`Offer must be higher than base price ($${basePrice})`);
    }

    const [highestRows] = await pool.query<RowDataPacket[]>(
      `SELECT MAX(offered_price) as highest
        FROM offers
        WHERE bid_id = ? AND status != 'rejected' AND offer_id != ?`,
      [offer.bid_id, id]
    );

    const currentHighest = parseFloat(String(highestRows[0]?.highest)) || 0;
    if (currentHighest > 0 && price <= currentHighest) {
      throw BadRequest(`Offer must be higher than current highest bid ($${currentHighest})`);
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE offers SET offered_price = COALESCE(?, offered_price), updated_at = NOW() WHERE offer_id = ?`,
    [offered_price ?? null, id]
  );

  if (result.affectedRows === 0) throw NotFound("No offer found to update");
  return result;
};

const deleteOffer = async (id: string, user_id: number, user_role: string) => {
  const [offerRows] = await pool.query<RowDataPacket[]>(
    `SELECT o.*, b.seller_id
      FROM offers o
     JOIN bids b ON o.bid_id = b.bid_id
     WHERE o.offer_id = ?`,
    [id]
  );

  if (offerRows.length === 0) throw NotFound("Offer not found");
  
  const offer = offerRows[0]!;
  const isBuyer = offer.buyer_id === user_id;
  const isSeller = offer.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isBuyer && !isSeller && !isAdmin) {
    throw Forbidden("Forbidden: You do not have permission to delete this offer");
  }

  if (isBuyer && !isAdmin && offer.status !== 'pending') {
    throw BadRequest("Cannot delete a non-pending offer");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM offers WHERE offer_id = ?`, [id]
  );

  if (result.affectedRows === 0) throw NotFound("No offer found to delete");
  return result;
};

const acceptOffer = async (offer_id: string, seller_id: string) => {
  const [offerRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM offers WHERE offer_id = ?`, [offer_id]
  );
  if (offerRows.length === 0) throw NotFound("Offer not found");
  const offer = offerRows[0]!;

  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT * FROM bids WHERE bid_id = ?`, [offer.bid_id]
  );
  if (bidRows.length === 0) throw NotFound("Bid not found");
  const bid = bidRows[0]!;

  if (String(bid.seller_id) !== String(seller_id)) {
    throw Forbidden("Unauthorized: You do not own this auction");
  }

  if (bid.status !== 'open') {
    throw BadRequest("Auction is already closed or completed");
  }

  await pool.query<ResultSetHeader>(
    `UPDATE offers SET status = 'accepted' WHERE offer_id = ?`, [offer_id]
  );

  await pool.query<ResultSetHeader>(
    `UPDATE offers SET status = 'rejected' WHERE bid_id = ? AND offer_id != ?`,
    [bid.bid_id, offer_id]
  );

  await pool.query<ResultSetHeader>(
    `UPDATE bids SET status = 'closed', end_time = NOW() WHERE bid_id = ?`,
    [bid.bid_id]
  );

  try {
    let remainingToDeduct = offer.quantity ?? 1;
    const [invRows] = await pool.query<RowDataPacket[]>(
      `SELECT i.inventory_id, i.quantity, i.warehouse_id
        FROM inventory i
       JOIN rents r ON i.warehouse_id = r.warehouse_id
       WHERE i.product_id = ? AND r.seller_id = ? AND i.quantity > 0
         AND r.status = 'active'
         AND r.start_date <= CURDATE()
         AND (r.end_date >= CURDATE() OR r.end_date IS NULL)
       ORDER BY i.quantity DESC`,
      [bid.product_id, seller_id]
    );

    for (const inv of invRows) {
      if (remainingToDeduct <= 0) break;
      const deductAmount = Math.min(inv.quantity, remainingToDeduct);
      const newQty = inv.quantity - deductAmount;

      if (newQty <= 0) {
        await pool.query<ResultSetHeader>(`DELETE FROM inventory WHERE inventory_id = ?`, [inv.inventory_id]);
      } else {
        await pool.query<ResultSetHeader>(`UPDATE inventory SET quantity = ? WHERE inventory_id = ?`, [newQty, inv.inventory_id]);
      }
      remainingToDeduct -= deductAmount;
    }

    if (remainingToDeduct > 0) {
      console.error(`Inventory deduction incomplete for offer ${offer_id}: ${remainingToDeduct} unit(s) short`);
    }
  } catch (invErr) {
    console.error("Inventory deduction failed:", invErr);
  }

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

  try {
    // Notify buyer that offer was accepted
    await pool.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        offer.buyer_id,
        'bid_update',
        `Your offer of $${offer.offered_price} was accepted! Complete payment to finalize.`,
        'bid',
        bid.bid_id,
      ]
    );

    // Notify seller that transaction is pending payment
    await pool.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        seller_id,
        'transaction',
        `Auction closed! A transaction for $${offer.offered_price} has been created and is awaiting the buyer's payment.`,
        'transaction',
        txResult.insertId,
      ]
    );

    // Notify other buyers that their offers were rejected
    await pool.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
       SELECT buyer_id, 'bid_update', 
          CONCAT('Your offer on auction #', ?, ' was not selected'), 'bid', ?
       FROM offers 
       WHERE bid_id = ? AND offer_id != ? AND status = 'rejected'`,
      [bid.bid_id, bid.bid_id, bid.bid_id, offer_id]
    );
  } catch (notifErr) {
    console.error("Notification failed:", notifErr);
  }

  return txResult.insertId;
};

const getMyOffers = async (
  buyer_id: string,
  page?: number | string,
  limit?: number | string
) => {
  const { pageNum, limitNum, offset } = parsePagination(page, limit);

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM offers WHERE buyer_id = ?`,
    [buyer_id]
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       o.*,
      p.name as product_name,
      p.image_url,
      b.end_time,
      b.status as bid_status,
      u.name as seller_name,
      (SELECT t.status FROM transactions t 
        WHERE t.bid_id = b.bid_id AND t.from_id = o.buyer_id 
        ORDER BY t.transaction_time DESC LIMIT 1) as payment_status,
      (SELECT t.transaction_id FROM transactions t 
        WHERE t.bid_id = b.bid_id AND t.from_id = o.buyer_id 
        ORDER BY t.transaction_time DESC LIMIT 1) as transaction_id
    FROM offers o
    JOIN bids b ON o.bid_id = b.bid_id
    JOIN products p ON b.product_id = p.product_id
    JOIN users u ON b.seller_id = u.user_id
    WHERE o.buyer_id = ?
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?`,
    [buyer_id, limitNum, offset]
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const offersService = {
  addOffer,
  getOffers,
  getSingleOffer,
  updateOffer,
  deleteOffer,
  getBidOffers,
  acceptOffer,
  getMyOffers,
};