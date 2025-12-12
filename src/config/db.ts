import mysql from "mysql2/promise";
import config from ".";

// Validate critical fields
if (!config.host || !config.user || !config.database || !config.db_port) {
  throw new Error("❌ Database configuration is missing or invalid!");
}

// Create MySQL connection pool
export const pool = mysql.createPool({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  port: Number(config.db_port),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize Database Tables
export const initialDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        status ENUM('active', 'blocked') DEFAULT 'active',
        role ENUM('buyer', 'seller', 'warehouse_owner', 'admin') NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Users table created successfully!");
  } catch (error: any) {
    console.error("DB Initialization Error:", error.message);
  }
};
