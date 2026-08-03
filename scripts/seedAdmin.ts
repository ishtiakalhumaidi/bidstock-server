// scripts/seedAdmin.ts
//
// One-time admin bootstrap script. Run once, then delete or leave in repo
// (it's idempotent — safe to re-run, it just won't create a duplicate).
//
// Usage:
//   npx ts-node scripts/seedAdmin.ts
//
// Reads credentials from env vars so the password never has to be typed
// into shell history or committed to a script file:
//   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME (optional, defaults below)
//
// Example:
//   ADMIN_EMAIL=owner@bidstock.com ADMIN_PASSWORD=changeme123 npx ts-node scripts/seedAdmin.ts

import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../src/config/db";

interface UserRow extends RowDataPacket {
  user_id: number;
}

const SALT_ROUNDS = 10;

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Platform Admin";

  if (!email || !password) {
    console.error(
      "Missing ADMIN_EMAIL or ADMIN_PASSWORD env vars.\n" +
      "Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npx ts-node scripts/seedAdmin.ts"
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  try {
    const [existing] = await pool.query<UserRow[]>(
      `SELECT user_id FROM users WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      console.log(`Admin (or another user) with email "${email}" already exists — nothing to do. user_id=${existing[0]!.user_id}`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users(email, phone, status, role, password, name, user_image) 
       VALUES(?, NULL, 'active', 'admin', ?, ?, NULL)`,
      [email, hashedPassword, name]
    );

    console.log(`✅ Admin account created. user_id=${result.insertId}, email=${email}`);
    console.log("You can now sign in at POST /auth/signin and use the token to hit /auth/create-admin for any future admins.");
  } catch (error) {
    console.error("Failed to seed admin:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();