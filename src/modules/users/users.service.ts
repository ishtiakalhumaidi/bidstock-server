import type { QueryResult, ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const createUser = async (payload: Record<string, unknown>) => {
  const { email, phone, status, role, password, name } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `
        INSERT INTO users(email, phone, status, role, password, name ) VALUES(?,?,?,?,?,?)
        `,
    [email, phone, status, role, password, name]
  );
  const insertId = result.insertId


   switch (role) {
      case 'buyer':
        await pool.query(`INSERT INTO buyers (user_id) VALUES (?)`, [insertId]);
        break;

      case 'seller':
        await pool.query(`INSERT INTO sellers (user_id) VALUES (?)`, [insertId]);
        break;

      case 'warehouse_owner':
        await pool.query(
          `INSERT INTO warehouse_owners (user_id) VALUES (?)`,
          [insertId]
        );
        break;

      case 'admin':
        break;

      default:
        throw new Error('Invalid role');
    }

  return insertId;
};

const getUsers = async () => {
  const result = await pool.query(`
        SELECT * FROM users
        `);
  return result;
};
const getSingleUser = async (user_id: string) => {
  const result = await pool.query(
    `
        SELECT * FROM users WHERE user_id=?
        `,
    [user_id]
  );
  return result;
};

const updateUser = async (
  payload: Record<string, unknown>,
  user_id: string
) => {
  const { email, phone, status, role, name } = payload;
  const result = await pool.query(
    `
        UPDATE users SET email=?, phone=?, status=?, role=?, name=? WHERE user_id=?
        `,
    [email, phone, status, role, name, user_id]
  );

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
  createUser,
  updateUser,
  deleteUser
};
