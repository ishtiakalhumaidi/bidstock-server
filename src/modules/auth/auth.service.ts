import Jwt from "jsonwebtoken";
import config from "../../config";
import { pool } from "../../config/db";
import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";

const signUpUser = async (payload: Record<string, unknown>) => {
  const { email, phone, status, role, password, name, user_image } = payload;

  const hashedPassword = await bcrypt.hash(password as string, 10);
  const [result] = await pool.query<ResultSetHeader>(
    `
        INSERT INTO users(email, phone, status, role, password, name,user_image ) VALUES(?,?,?,?,?,?,?)
        `,
    [email, phone, status, role, hashedPassword, name, user_image]
  );
  const insertId = result.insertId;

  switch (role) {
    case "buyer":
      await pool.query(`INSERT INTO buyers (user_id) VALUES (?)`, [insertId]);
      break;

    case "seller":
      await pool.query(`INSERT INTO sellers (user_id) VALUES (?)`, [insertId]);
      break;

    case "warehouse_owner":
      await pool.query(`INSERT INTO warehouse_owners (user_id) VALUES (?)`, [
        insertId,
      ]);
      break;

    case "admin":
      break;

    default:
      throw new Error("Invalid role");
  }

  return insertId;
};

const signinUser = async (email: string, password: string) => {
  const [rows] = await pool.query(`SELECT * FROM users WHERE email=?`, [email]);

  if ((rows as any[]).length === 0) {
    throw new Error("no user found");
  }

  const user = (rows as any[])[0];

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new Error("incorrect password");
  }

  const secret = `${config.jwt_secret}`;
  const token = Jwt.sign(
    {
      name: user.name,
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    },
    secret,
    {
      expiresIn: "7d",
    }
  );

  delete user.password;

  return { token, user };
};

export const authService = {
  signinUser,
  signUpUser,
};
