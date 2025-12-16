import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addNotification = async (payload: Record<string, unknown>) => {
  const {
    user_id,
    type,
    message,
    related_entity_type,
    related_entity_id,
  } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO notifications(
      user_id,
      type,
      message,
      related_entity_type,
      related_entity_id
    ) VALUES (?,?,?,?,?)`,
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

const getNotifications = async () => {
  const result = await pool.query(`SELECT * FROM notifications`);
  return result;
};

const getSingleNotification = async (id: string) => {
  const result = await pool.query(
    `SELECT * FROM notifications WHERE notification_id=?`,
    [id]
  );
  return result;
};

const getMyNotifications = async (user_id: string) => {
  const result = await pool.query(
    `SELECT * FROM notifications 
     WHERE user_id=? 
     ORDER BY created_at DESC`,
    [user_id]
  );
  return result;
};

const markAsRead = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE notifications 
     SET is_read=TRUE 
     WHERE notification_id=?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no notification found to update");
  }

  return result;
};

const deleteNotification = async (id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM notifications WHERE notification_id=?`,
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no notification found to delete");
  }

  return result;
};

export const notificationsService = {
  addNotification,
  getNotifications,
  getSingleNotification,
  getMyNotifications,
  markAsRead,
  deleteNotification,
};
