import Jwt from "jsonwebtoken";
import config from "../../config";
import { pool } from "../../config/db";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

// 1. Explicit input payload interface
export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
  role: "buyer" | "seller" | "warehouse_owner" | "admin";
  phone?: string | null;
  status?: "active" | "suspended" | "inactive";
  user_image?: string | null;
}

// 2. Database model typing
export interface UserRow extends RowDataPacket {
  user_id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  password: string;
  phone: string | null;
  user_image: string | null;
  created_at: Date;
  updated_at: Date;
}

const SALT_ROUNDS = 10;

const signUpUser = async (payload: SignUpPayload) => {
  const { email, phone, status, role, password, name, user_image } = payload;

  if (!email || !password || !name || !role) {
    throw new Error("Missing required fields: email, password, name, role");
  }

  // Acquire connection early to handle both existence check & transaction safely
  const connection = await pool.getConnection();

  try {
    const [existingRows] = await connection.query<UserRow[]>(
      `SELECT user_id FROM users WHERE email = ?`,
      [email]
    );

    if (existingRows.length > 0) {
      throw new Error("Email already registered");
    }

    const validRoles = ["buyer", "seller", "warehouse_owner", "admin"] as const;
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO users(email, phone, status, role, password, name, user_image) 
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [email, phone ?? null, status ?? "active", role, hashedPassword, name, user_image ?? null]
    );

    const insertId = result.insertId;

    switch (role) {
      case "buyer":
        await connection.query(`INSERT INTO buyers (user_id) VALUES (?)`, [insertId]);
        break;
      case "seller":
        await connection.query(`INSERT INTO sellers (user_id) VALUES (?)`, [insertId]);
        break;
      case "warehouse_owner":
        await connection.query(`INSERT INTO warehouse_owners (user_id) VALUES (?)`, [insertId]);
        break;
      case "admin":
        break;
    }

    await connection.commit();
    return insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const signinUser = async (email: string, password: string) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const [rows] = await pool.query<UserRow[]>(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );

  const user = rows[0];

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.status === "suspended") {
    throw new Error("Account suspended. Contact support.");
  }
  if (user.status === "inactive") {
    throw new Error("Account is inactive. Please contact support.");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new Error("Invalid email or password");
  }

  const token = Jwt.sign(
    {
      name: user.name,
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    },
    config.jwt_secret as string,
    { expiresIn: "15m" }
  );

  const refreshToken = Jwt.sign(
    { user_id: user.user_id },
    config.jwt_secret as string,
    { expiresIn: "7d" }
  );

  const userWithoutPassword: Omit<UserRow, "password"> = {
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    phone: user.phone,
    user_image: user.user_image,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };

  return {
    token,
    refreshToken,
    user: userWithoutPassword,
  };
};

export const authService = {
  signinUser,
  signUpUser,
};