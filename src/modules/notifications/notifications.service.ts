// notifications.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

interface NotificationRow extends RowDataPacket {
  notification_id: number;
  user_id: number;
  type: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: number | null;
  is_read: boolean;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetMyNotificationsQuery {
  page?: number | string;
  limit?: number | string;
  type?: "bid_update" | "transaction" | "inventory_alert" | "system";
  is_read?: boolean | string;
}

const VALID_TYPES = ["bid_update", "transaction", "inventory_alert", "system"];
const VALID_ENTITY_TYPES = ["bid", "transaction", "inventory", "warehouse", "system"];

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

// ---- Service methods -----------------------------------------------------

const addNotification = async (payload: Record<string, unknown>) => {
  const { user_id, type, message, related_entity_type, related_entity_id } = payload;

  if (!user_id || !type || !message) {
    throw BadRequest("user_id, type, and message are required");
  }

  if (!VALID_TYPES.includes(type as string)) {
    throw BadRequest(`Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`);
  }

  if (related_entity_type !== undefined && related_entity_type !== null) {
    if (!VALID_ENTITY_TYPES.includes(related_entity_type as string)) {
      throw BadRequest(`Invalid related_entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`);
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
      VALUES (?, ?, ?, ?, ?)`,
    [
      user_id,
      type,
      message,
      related_entity_type ?? null,
      related_entity_id ?? null,
    ]
  );

  return result.insertId;
};

const notifyLowStock = async (params: {
  seller_id: number;
  product_name: string;
  warehouse_location?: string;
  quantity: number;
  min_stock_level: number;
  inventory_id: number;
}) => {
  const { seller_id, product_name, warehouse_location, quantity, min_stock_level, inventory_id } = params;
  
  await pool.query<ResultSetHeader>(
    `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      seller_id,
      'inventory_alert',
      `Low stock alert: "${product_name}"${warehouse_location ? ` at ${warehouse_location}` : ''} has ${quantity} units left (below minimum of ${min_stock_level}).`,
      'inventory',
      inventory_id,
    ]
  );
};

const getMyNotifications = async (
  user_id: string | number,
  query: GetMyNotificationsQuery = {}
) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [`user_id = ?`];
  const params: unknown[] = [user_id];

  if (query.type) {
    whereClauses.push(`type = ?`);
    params.push(query.type);
  }

  if (query.is_read !== undefined) {
    const isReadBool = query.is_read === true || query.is_read === "true";
    whereClauses.push(`is_read = ?`);
    params.push(isReadBool);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM notifications ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<NotificationRow[]>(
    `SELECT * FROM notifications 
      ${whereSQL}
     ORDER BY created_at DESC 
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

const getUnreadCount = async (user_id: string | number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
    [user_id]
  );
  return rows[0]?.count ?? 0;
};

const markAsRead = async (notification_id: string, user_id: number) => {
  const [notifRows] = await pool.query<NotificationRow[]>(
    `SELECT * FROM notifications WHERE notification_id = ?`,
    [notification_id]
  );

  if (notifRows.length === 0) {
    throw NotFound("Notification not found");
  }

  const notif = notifRows[0]!;
  if (notif.user_id !== user_id) {
    throw Forbidden("Forbidden: You do not own this notification");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE notifications SET is_read = TRUE WHERE notification_id = ?`,
    [notification_id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No notification found to update");
  }

  return result;
};

const markAllAsRead = async (user_id: number) => {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
    [user_id]
  );
  return result;
};

const deleteNotification = async (notification_id: string, user_id: number) => {
  const [notifRows] = await pool.query<NotificationRow[]>(
    `SELECT * FROM notifications WHERE notification_id = ?`,
    [notification_id]
  );

  if (notifRows.length === 0) {
    throw NotFound("Notification not found");
  }

  const notif = notifRows[0]!;
  if (notif.user_id !== user_id) {
    throw Forbidden("Forbidden: You do not own this notification");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM notifications WHERE notification_id = ?`,
    [notification_id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No notification found to delete");
  }

  return result;
};

export const notificationsService = {
  addNotification,
  notifyLowStock,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};