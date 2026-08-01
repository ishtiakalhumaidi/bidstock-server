import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

interface BidRow extends RowDataPacket {
  bid_id: number;
  seller_id: number;
  product_id: number;
  starting_bid: number;
  base_price?: number; // fallback for legacy
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

const addOffer = async (payload: Record<string, unknown>) => {
  const {
    bid_id,
    buyer_id,
    offered_price,
    status,
    is_suspicious,
    flag_reason,
  } = payload;

  if (!bid_id || !buyer_id || !offered_price) {
    throw new Error("bid_id, buyer_id, and offered_price are required");
  }

  // 1. Validate bid exists and is open
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT b.*, p.name as product_name 
     FROM bids b
     JOIN products p ON b.product_id = p.product_id
     WHERE b.bid_id = ?`,
    [bid_id]
  );

  if (bidRows.length === 0) throw new Error("Auction not found");
  const bid = bidRows[0]!;

  if (bid.status !== 'open') {
    throw new Error("This auction is closed");
  }

  if (bid.end_time && new Date(bid.end_time) < new Date()) {
    throw new Error("This auction has expired");
  }

  // 2. Prevent self-bidding
  if (String(bid.seller_id) === String(buyer_id)) {
    throw new Error("You cannot bid on your own auction");
  }

  // 3. Validate offer price
  const offerPrice = parseFloat(offered_price as string);
  const basePrice = parseFloat(String(bid.starting_bid ?? bid.base_price ?? 0));

  if (isNaN(offerPrice) || offerPrice <= 0) {
    throw new Error("Invalid offer price");
  }

  if (offerPrice <= basePrice) {
    throw new Error(`Offer must be higher than base price ($${basePrice})`);
  }

  // 4. Check against current highest bid
  const [highestRows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(offered_price) as highest FROM offers WHERE bid_id = ? AND status != 'rejected'`,
    [bid_id]
  );
  const currentHighest = parseFloat(String(highestRows[0]?.highest)) || 0;

  if (currentHighest > 0 && offerPrice <= currentHighest) {
    throw new Error(`Offer must be higher than current highest bid ($${currentHighest})`);
  }

  // 5. Prevent duplicate pending offers from same buyer
  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM offers WHERE bid_id = ? AND buyer_id = ? AND status = 'pending'`,
    [bid_id, buyer_id]
  );
  if (existingRows.length > 0) {
    throw new Error("You already have a pending offer on this auction");
  }

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

  // Notify seller of new offer
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        bid.seller_id,
        'bid_update',
        `New offer of $${offered_price} on your auction for ${bid.product_name || 'product'}`,
        'bid',
        bid_id,
      ]
    );
  } catch (notifErr) {
    console.error("Failed to send notification:", notifErr);
  }

  return result.insertId;
};

const getOffers = async (user_role: string) => {
  if (user_role !== 'admin') {
    throw new Error("Forbidden: Admin access required");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.*, b.seller_id, p.name as product_name, u.name as buyer_name
     FROM offers o
     JOIN bids b ON o.bid_id = b.bid_id
     JOIN products p ON b.product_id = p.product_id
     JOIN users u ON o.buyer_id = u.user_id
     ORDER BY o.created_at DESC
     LIMIT 100`
  );
  return rows;
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

  if (rows.length === 0) throw new Error("Offer not found");
  const offer = rows[0]!;

  const isBuyer = offer.buyer_id === user_id;
  const isSeller = offer.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to view this offer");
  }

  return offer;
};

const getBidOffers = async (bid_id: string, user_id: number, user_role: string) => {
  // Verify bid exists
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT seller_id FROM bids WHERE bid_id = ?`, [bid_id]
  );
  if (bidRows.length === 0) throw new Error("Bid not found");

  // If seller, verify they own the bid
  if (user_role === 'seller' && bidRows[0]!.seller_id !== user_id) {
    throw new Error("Unauthorized: You do not own this auction");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      o.*,
      u.name as buyer_name,
      u.email as buyer_email,
      u.user_image as buyer_image
    FROM offers o
    JOIN users u ON o.buyer_id = u.user_id
    WHERE o.bid_id = ?
    ORDER BY o.offered_price DESC`,
    [bid_id]
  );
  return rows;
};

const updateOffer = async (payload: Record<string, unknown>, id: string, user_id: number) => {
  const [offerRows] = await pool.query<OfferRow[]>(
    `SELECT * FROM offers WHERE offer_id = ?`, [id]
  );
  if (offerRows.length === 0) throw new Error("Offer not found");
  const offer = offerRows[0]!;

  if (offer.buyer_id !== user_id) {
    throw new Error("Forbidden: You can only update your own offers");
  }
  if (offer.status !== 'pending') {
    throw new Error("Cannot update a non-pending offer");
  }

  const { offered_price } = payload;
  if (offered_price !== undefined) {
    const price = parseFloat(offered_price as string);
    if (isNaN(price) || price <= 0) {
      throw new Error("Invalid offer price");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE offers SET offered_price = COALESCE(?, offered_price), updated_at = NOW() WHERE offer_id = ?`,
    [offered_price ?? null, id]
  );

  if (result.affectedRows === 0) throw new Error("No offer found to update");
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
  if (offerRows.length === 0) throw new Error("Offer not found");
  const offer = offerRows[0]!;

  const isBuyer = offer.buyer_id === user_id;
  const isSeller = offer.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new Error("Forbidden: You do not have permission to delete this offer");
  }

  // Buyers can only delete pending offers
  if (isBuyer && !isAdmin && offer.status !== 'pending') {
    throw new Error("Cannot delete a non-pending offer");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM offers WHERE offer_id = ?`, [id]
  );
  if (result.affectedRows === 0) throw new Error("No offer found to delete");
  return result;
};

const acceptOffer = async (offer_id: string, seller_id: string) => {
  // 1. Fetch and validate offer
  const [offerRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM offers WHERE offer_id = ?`, [offer_id]
  );
  if (offerRows.length === 0) throw new Error("Offer not found");
  const offer = offerRows[0]!;

  // 2. Fetch and validate bid
  const [bidRows] = await pool.query<BidRow[]>(
    `SELECT * FROM bids WHERE bid_id = ?`, [offer.bid_id]
  );
  if (bidRows.length === 0) throw new Error("Bid not found");
  const bid = bidRows[0]!;

  // 3. Authorization check
  if (String(bid.seller_id) !== String(seller_id)) {
    throw new Error("Unauthorized: You do not own this auction");
  }

  // 4. Bid status check
  if (bid.status !== 'open') {
    throw new Error("Auction is already closed or completed");
  }

  // 5. Accept winning offer, reject all others, close bid
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

  // 6. Deduct inventory (1 unit default — TODO: use offer.quantity when added)
  try {
    const [invRows] = await pool.query<RowDataPacket[]>(
      `SELECT i.inventory_id, i.quantity, i.warehouse_id 
       FROM inventory i
       JOIN rents r ON i.warehouse_id = r.warehouse_id
       WHERE i.product_id = ? AND r.seller_id = ? AND i.quantity > 0
       ORDER BY i.quantity DESC
       LIMIT 1`,
      [bid.product_id, seller_id]
    );

    if (invRows.length > 0) {
      const inv = invRows[0]!;
      const newQty = inv.quantity - 1;
      
      if (newQty <= 0) {
        await pool.query<ResultSetHeader>(
          `DELETE FROM inventory WHERE inventory_id = ?`, [inv.inventory_id]
        );
      } else {
        await pool.query<ResultSetHeader>(
          `UPDATE inventory SET quantity = ? WHERE inventory_id = ?`,
          [newQty, inv.inventory_id]
        );
      }
    }
  } catch (invErr) {
    console.error("Inventory deduction failed:", invErr);
  }

  // 7. Create transaction record
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

  // 8. Notify buyer that offer was accepted
  try {
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

const getMyOffers = async (buyer_id: string) => {
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
    ORDER BY o.created_at DESC`,
    [buyer_id]
  );
  return rows;
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