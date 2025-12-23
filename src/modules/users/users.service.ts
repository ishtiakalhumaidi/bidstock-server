import type { QueryResult, ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db";



const getUsers = async () => {
  const result = await pool.query(`
        SELECT * FROM users
        `);
  return result;
};

const getSingleUser = async (user_id: string) => {
  
  const [result] = await pool.query(
    `
        SELECT * FROM users WHERE user_id=?
        `,
    [user_id]
  );
  return result;
};
const getDashboardStats = async (user_id: string, role: string) => {
  const stats: any = {};

  if (role === 'seller') {
    const [revenue] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(amount) as total FROM transactions WHERE to_id=? AND to_role='seller' AND status='completed'`,
      [user_id]
    );
    stats.total_revenue = revenue[0].total || 0;

    const [activeBids] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bids WHERE seller_id=? AND status='open'`,
      [user_id]
    );
    stats.active_auctions = activeBids[0].count;

 
    const [inv] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(i.quantity) as total 
       FROM inventory i 
       JOIN products p ON i.product_id = p.product_id 
       WHERE p.seller_id=?`,
      [user_id]
    );
    stats.total_inventory = inv[0].total || 0;
    const [rents] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM rents WHERE seller_id=? AND status='active'`,
      [user_id]
    );
    stats.active_rents = rents[0].count;
  } 
  
  else if (role === 'buyer') {
    const [spent] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(amount) as total FROM transactions WHERE from_id=? AND from_role='buyer' AND status='completed'`,
      [user_id]
    );
    stats.total_spent = spent[0].total || 0;


    const [offers] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM offers WHERE buyer_id=? AND status='pending'`,
      [user_id]
    );
    stats.pending_offers = offers[0].count;

    const [wins] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM offers WHERE buyer_id=? AND status='accepted'`,
      [user_id]
    );
    stats.won_auctions = wins[0].count;
  } 
  
  else if (role === 'warehouse_owner') {
    const [earnings] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(amount) as total FROM transactions WHERE to_id=? AND to_role='warehouse_owner' AND status='completed'`,
      [user_id]
    );
    stats.total_earnings = earnings[0].total || 0;

  
    const [warehouses] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM warehouses WHERE owner_id=?`,
      [user_id]
    );
    stats.total_warehouses = warehouses[0].count;

    const [tenants] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM rents r 
       JOIN warehouses w ON r.warehouse_id = w.warehouse_id 
       WHERE w.owner_id=? AND r.status='active'`,
      [user_id]
    );
    stats.active_tenants = tenants[0].count;
  }

  return stats;
};

const updateUser = async (
  payload: Record<string, unknown>,
  user_id: string
) => {
  const keys = Object.keys(payload).filter((key) => payload[key] !== undefined);
  
  if (keys.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  const setClause = keys.map((key) => `${key}=?`).join(", ");
  const values = keys.map((key) => payload[key]);
  
  values.push(user_id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE users SET ${setClause} WHERE user_id=?`,
    values
  );

  if (result.affectedRows === 0) {
    throw new Error("no user found to update");
  }

  return result;
};

const deleteUser = async (user_id: string) => {
  const result = await pool.query(
    `
        DELETE FROM users WHERE user_id=?
        `,
    [user_id]
  );

  return result;
};

export const userService = {
  getUsers,
  getSingleUser,
  updateUser,
  getDashboardStats,
  deleteUser
};
