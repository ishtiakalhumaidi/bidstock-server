import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

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

const addNotification = async (payload: Record<string, unknown>) => {
  const { user_id, type, message, related_entity_type, related_entity_id } = payload;

  if (!user_id || !type || !message) {
    throw new Error("user_id, type, and message are required");
  }

  const validTypes = ["bid_update", "transaction", "inventory_alert", "system"];
  if (!validTypes.includes(type as string)) {
    throw new Error(`Invalid type. Must be one of: ${validTypes.join(", ")}`);
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

const getMyNotifications = async (user_id: string | number) => {
  const [rows] = await pool.query<NotificationRow[]>(
    `SELECT * FROM notifications 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [user_id]
  );
  return rows;
};

const getUnreadCount = async (user_id: string | number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
    [user_id]
  );
  return rows[0]?.count ?? 0;
};

const markAsRead = async (notification_id: string, user_id: number) => {
  // Verify ownership first
  const [notifRows] = await pool.query<NotificationRow[]>(
    `SELECT * FROM notifications WHERE notification_id = ?`,
    [notification_id]
  );

  if (notifRows.length === 0) {
    throw new Error("Notification not found");
  }

  const notif = notifRows[0]!;
  if (notif.user_id !== user_id) {
    throw new Error("Forbidden: You do not own this notification");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE notifications SET is_read = TRUE WHERE notification_id = ?`,
    [notification_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No notification found to update");
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
  // Verify ownership first
  const [notifRows] = await pool.query<NotificationRow[]>(
    `SELECT * FROM notifications WHERE notification_id = ?`,
    [notification_id]
  );

  if (notifRows.length === 0) {
    throw new Error("Notification not found");
  }

  const notif = notifRows[0]!;
  if (notif.user_id !== user_id) {
    throw new Error("Forbidden: You do not own this notification");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM notifications WHERE notification_id = ?`,
    [notification_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No notification found to delete");
  }

  return result;
};

export const notificationsService = {
  addNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};