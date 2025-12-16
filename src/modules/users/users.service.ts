import type { QueryResult, ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";



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
  updateUser,
  deleteUser
};
