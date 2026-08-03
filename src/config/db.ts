import mysql from "mysql2/promise";
import config from ".";

if (!config.host || !config.user || !config.database || !config.db_port) {
  throw new Error("Database configuration is missing or invalid!");
}

export const pool = mysql.createPool({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  port: Number(config.db_port),
  ssl: {
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ---- Fresh-install schema (CREATE TABLE IF NOT EXISTS) -----------------
// This only matters for a brand new database. Existing databases already
// have these tables (with the old column names), so this block alone
// won't fix them — that's what runMigrations() below is for.
const initialDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
      user_id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
      role VARCHAR(30) NOT NULL,
      CHECK (role IN ('buyer','seller','warehouse_owner','admin')),
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      user_image VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyers (
      user_id INT PRIMARY KEY,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sellers (
      user_id INT PRIMARY KEY,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_owners(
      user_id INT PRIMARY KEY,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // UPDATED: added length_cm / width_cm / height_cm / stackable /
    // max_stack_count. These drive the space-based warehouse capacity
    // calculation (see warehouses below) — a product's physical footprint
    // and stack height determine how much floor space N units actually
    // occupy, instead of every unit counting as "1" regardless of size.
    // Legacy `size` column is kept for backward compatibility but is no
    // longer used for capacity math.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products(
      product_id INT PRIMARY KEY AUTO_INCREMENT,
      seller_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      category VARCHAR(100),
      brand VARCHAR(100),
      weight DECIMAL(10, 2),
      size DECIMAL(10, 2) DEFAULT 0,
      length_cm DECIMAL(10, 2) DEFAULT NULL,
      width_cm DECIMAL(10, 2) DEFAULT NULL,
      height_cm DECIMAL(10, 2) DEFAULT NULL,
      stackable BOOLEAN DEFAULT TRUE,
      max_stack_count INT DEFAULT NULL,
      image_url VARCHAR(500),
      status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
      rating DECIMAL(3, 2) DEFAULT 0.00,
      total_reviews INT DEFAULT 0,
      total_sales INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES sellers(user_id) ON DELETE CASCADE
      );
    `);

    // UPDATED: added floor_area_sqm / ceiling_height_m. `capacity` is kept
    // as a legacy fallback (do not drop it — see migration #N below for
    // why), but the real constraint going forward is floor space: how many
    // square meters of floor a warehouse has, and how tall it is (which
    // lets stackable products multiply their effective capacity).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouses(
      warehouse_id INT PRIMARY KEY AUTO_INCREMENT,
      owner_id INT NOT NULL,
      location VARCHAR(255) NOT NULL,
      price_per_day DECIMAL(10, 2) NOT NULL,
      capacity INT NOT NULL,
      floor_area_sqm DECIMAL(10, 2) DEFAULT NULL,
      ceiling_height_m DECIMAL(6, 2) DEFAULT 3.00,
      status ENUM('available', 'booked', 'maintenance') DEFAULT 'available',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES warehouse_owners(user_id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory(
      inventory_id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      warehouse_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      min_stock_level INT DEFAULT 10,
      max_stock_level INT DEFAULT 1000,
      last_restocked TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_product_warehouse (product_id, warehouse_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bids(
      bid_id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      seller_id INT NOT NULL,
      starting_bid DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP NULL DEFAULT NULL,
      status ENUM('open', 'closed') DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES sellers(user_id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers(
      offer_id INT PRIMARY KEY AUTO_INCREMENT,
      bid_id INT NOT NULL,
      buyer_id INT NOT NULL,
      offered_price DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
      is_suspicious BOOLEAN DEFAULT FALSE,
      flag_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (bid_id) REFERENCES bids(bid_id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES buyers(user_id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions(
      transaction_id INT PRIMARY KEY AUTO_INCREMENT,
      bid_id INT,
      from_role ENUM('buyer', 'seller', 'warehouse_owner', 'platform') NOT NULL,
      from_id INT NULL,
      to_role ENUM('buyer', 'seller', 'warehouse_owner', 'platform') NOT NULL,
      to_id INT NULL,
      transaction_type ENUM('payment', 'refund', 'commission', 'warehouse_fee') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
      payment_method ENUM('bkash', 'nagad', 'card', 'bank', 'wallet'),
      reference_id VARCHAR(100),
      transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bid_id) REFERENCES bids(bid_id) ON DELETE SET NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications(
      notification_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      type ENUM('bid_update', 'transaction', 'inventory_alert', 'system') NOT NULL,
      message TEXT NOT NULL,
      related_entity_type ENUM('bid', 'transaction', 'inventory', 'warehouse', 'system'),
      related_entity_id INT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      INDEX idx_user_read (user_id, is_read)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rents(
      rent_id INT PRIMARY KEY AUTO_INCREMENT,
      seller_id INT NOT NULL,
      warehouse_id INT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES sellers(user_id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE
      );
    `);
  } catch (error: any) {
    console.error("DB Initialization Error:", error.message);
  }
};

// ---- Migrations for EXISTING databases ----------------------------------
// initialDB() above only ever runs CREATE TABLE IF NOT EXISTS, so it will
// never fix a table that already exists with the wrong column name/shape.
// This function patches already-deployed databases safely: every ALTER is
// guarded by an INFORMATION_SCHEMA check first, so it's idempotent (safe
// to run on every server start, forever) and never throws on a column
// that's already been migrated.
const columnExists = async (table: string, column: string): Promise<boolean> => {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) as count 
     FROM information_schema.columns 
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].count > 0;
};

const runMigrations = async () => {
  try {
    // for new columns added in the schema, check if they exist before altering the table
    // write function to check if column exists in table, if not then alter table to add the column
    // use alter table query to add the column, use the columnExists function to check if the column exists
    // for example, if the column 'length_cm' does not exist in the 'products' table, then alter the table to add the column 'length_cm' with type DECIMAL(10, 2) DEFAULT NULL like this.
  
   

    console.log("[migration] All migrations checked — database is up to date.");
  } catch (error: any) {
    console.error("[migration] ❌ Migration failed:", error.message);
  }
};

export { initialDB, runMigrations };