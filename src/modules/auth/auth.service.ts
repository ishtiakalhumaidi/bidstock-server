// auth.service.ts
import Jwt from "jsonwebtoken";
import config from "../../config";
import { pool } from "../../config/db";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  BadRequest,
  Unauthorized,
  Forbidden,
  Conflict,
} from "../../utils/AppError";

const PUBLIC_ROLES = ["buyer", "seller", "warehouse_owner"] as const;
type PublicRole = (typeof PUBLIC_ROLES)[number];

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
  role: PublicRole;
  phone?: string | null;
  user_image?: string | null;
}

export interface CreateAdminPayload {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  user_image?: string | null;
}

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

// ---- Helpers -----------------------------------------------------------

const stripPassword = (user: UserRow): Omit<UserRow, "password"> => ({
  user_id: user.user_id,
  email: user.email,
  name: user.name,
  role: user.role,
  status: user.status,
  phone: user.phone,
  user_image: user.user_image,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const signAccessToken = (user: UserRow) =>
  Jwt.sign(
    {
      name: user.name,
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      type: ACCESS_TOKEN_TYPE,
    },
    config.jwt_secret as string,
    { expiresIn: "15m" },
  );

const signRefreshToken = (user: UserRow) =>
  Jwt.sign(
    { user_id: user.user_id, type: REFRESH_TOKEN_TYPE },
    config.jwt_secret as string,
    { expiresIn: "7d" },
  );

// ---- Service methods -----------------------------------------------------

const signUpUser = async (payload: SignUpPayload) => {
  const { email, phone, role, password, name, user_image } = payload;

  if (!email || !password || !name || !role) {
    throw BadRequest("Missing required fields: email, password, name, role");
  }

  if (!PUBLIC_ROLES.includes(role)) {
    throw BadRequest(
      `Invalid role. Must be one of: ${PUBLIC_ROLES.join(", ")}`,
    );
  }

  const connection = await pool.getConnection();
  try {
    const [existingRows] = await connection.query<UserRow[]>(
      `SELECT user_id FROM users WHERE email = ?`,
      [email],
    );

    if (existingRows.length > 0) {
      throw Conflict("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO users(email, phone, status, role, password, name, user_image)
        VALUES(?, ?, 'active', ?, ?, ?, ?)`,
      [email, phone ?? null, role, hashedPassword, name, user_image ?? null],
    );

    const insertId = result.insertId;

    switch (role) {
      case "buyer":
        await connection.query(`INSERT INTO buyers (user_id) VALUES (?)`, [
          insertId,
        ]);
        break;
      case "seller":
        await connection.query(`INSERT INTO sellers (user_id) VALUES (?)`, [
          insertId,
        ]);
        break;
      case "warehouse_owner":
        await connection.query(
          `INSERT INTO warehouse_owners (user_id) VALUES (?)`,
          [insertId],
        );
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

const createAdminUser = async (payload: CreateAdminPayload) => {
  const { email, password, name, phone, user_image } = payload;

  if (!email || !password || !name) {
    throw BadRequest("Missing required fields: email, password, name");
  }

  if (password.length < 6) {
    throw BadRequest("Password must be at least 6 characters");
  }

  const [existingRows] = await pool.query<UserRow[]>(
    `SELECT user_id FROM users WHERE email = ?`,
    [email],
  );

  if (existingRows.length > 0) {
    throw Conflict("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users(email, phone, status, role, password, name, user_image)
      VALUES(?, ?, 'active', 'admin', ?, ?, ?)`,
    [email, phone ?? null, hashedPassword, name, user_image ?? null],
  );

  return result.insertId;
};

const signinUser = async (email: string, password: string) => {
  if (!email || !password) {
    throw BadRequest("Email and password are required");
  }

  const [rows] = await pool.query<UserRow[]>(
    `SELECT * FROM users WHERE email = ?`,
    [email],
  );

  const user = rows[0];

  if (!user) {
    throw Unauthorized("Invalid email or password");
  }

  if (user.status === "suspended") {
    throw Forbidden("Account suspended. Contact support.");
  }

  if (user.status === "inactive") {
    throw Forbidden("Account is inactive. Please contact support.");
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw Unauthorized("Invalid email or password");
  }

  return {
    token: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    user: stripPassword(user),
  };
};

const refreshAccessToken = async (refreshToken: string) => {
  if (!refreshToken) {
    throw BadRequest("Refresh token is required");
  }

  let decoded: { user_id: number; type?: string };
  try {
    decoded = Jwt.verify(refreshToken, config.jwt_secret as string) as {
      user_id: number;
      type?: string;
    };
  } catch {
    throw Unauthorized("Invalid or expired refresh token");
  }

  if (decoded.type !== REFRESH_TOKEN_TYPE) {
    throw Unauthorized("Invalid or expired refresh token");
  }

  const [rows] = await pool.query<UserRow[]>(
    `SELECT * FROM users WHERE user_id = ?`,
    [decoded.user_id],
  );

  const user = rows[0];
  if (!user) {
    throw Unauthorized("Invalid or expired refresh token");
  }

  if (user.status === "suspended") {
    throw Forbidden("Account suspended. Contact support.");
  }

  if (user.status === "inactive") {
    throw Forbidden("Account is inactive. Please contact support.");
  }

  return {
    token: signAccessToken(user),
    user: stripPassword(user),
  };
};

export const authService = {
  signinUser,
  signUpUser,
  createAdminUser,
  refreshAccessToken,
};
