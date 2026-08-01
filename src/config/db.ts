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

// Initialize Database Tables
export const initialDB = async () => {
  try {
    // 1. Users (central auth table)
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_status (status)
      );
    `);

    // 2. Role-specific sub-tables
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
      CREATE TABLE IF NOT EXISTS warehouse_owners (
        user_id INT PRIMARY KEY,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    // 3. Products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_id INT PRIMARY KEY AUTO_INCREMENT,
        seller_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        brand VARCHAR(100),
        weight DECIMAL(10, 2),
        size VARCHAR(50),
        image_url VARCHAR(500),
        status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
        rating DECIMAL(3, 2) DEFAULT 0.00,
        total_reviews INT DEFAULT 0,
        total_sales INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES sellers(user_id) ON DELETE CASCADE,
        INDEX idx_seller (seller_id),
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_price (price)
      );
    `);

    // 4. Warehouses
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        warehouse_id INT PRIMARY KEY AUTO_INCREMENT,
        owner_id INT NOT NULL,
        location VARCHAR(255) NOT NULL,
        price_per_day DECIMAL(10, 2) NOT NULL,
        capacity INT NOT NULL,
        status ENUM('available', 'booked', 'maintenance') DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES warehouse_owners(user_id) ON DELETE CASCADE,
        INDEX idx_owner (owner_id),
        INDEX idx_status (status)
      );
    `);

    // 5. Inventory (product stock per warehouse)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
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
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
        INDEX idx_product (product_id),
        INDEX idx_warehouse (warehouse_id)
      );
    `);

    // 6. Bids (auctions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bids (
        bid_id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        seller_id INT NOT NULL,
        starting_bid DECIMAL(10, 2) NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL DEFAULT NULL,
        status ENUM('open', 'closed') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES sellers(user_id) ON DELETE CASCADE,
        INDEX idx_product (product_id),
        INDEX idx_seller (seller_id),
        INDEX idx_status (status),
        INDEX idx_end_time (end_time)
      );
    `);

    // 7. Offers (buyer bids on auctions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers (
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
        FOREIGN KEY (buyer_id) REFERENCES buyers(user_id) ON DELETE CASCADE,
        INDEX idx_bid (bid_id),
        INDEX idx_buyer (buyer_id),
        INDEX idx_status (status)
      );
    `);

    // 8. Transactions (payments between parties)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INT PRIMARY KEY AUTO_INCREMENT,
        bid_id INT,
        from_role ENUM('buyer', 'seller', 'warehouse_owner', 'platform') NOT NULL,
        from_id INT NULL,
        to_role ENUM('buyer', 'seller', 'warehouse_owner', 'platform') NOT NULL,
        to_id INT NULL,
        transaction_type ENUM('payment', 'refund', 'commission', 'warehouse_fee') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        payment_method ENUM('bkash', 'nagad', 'card', 'bank', 'wallet'),
        reference_id VARCHAR(100),
        transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bid_id) REFERENCES bids(bid_id) ON DELETE SET NULL,
        INDEX idx_bid (bid_id),
        INDEX idx_from (from_id),
        INDEX idx_to (to_id),
        INDEX idx_status (status)
      );
    `);

    // 9. Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('bid_update', 'transaction', 'inventory_alert', 'system') NOT NULL,
        message TEXT NOT NULL,
        related_entity_type ENUM('bid', 'transaction', 'inventory', 'warehouse', 'system'),
        related_entity_id INT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_read (user_id, is_read),
        INDEX idx_type (type)
      );
    `);

    // 10. Rents (warehouse rentals by sellers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rents (
        rent_id INT PRIMARY KEY AUTO_INCREMENT,
        seller_id INT NOT NULL,
        warehouse_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        rental_price DECIMAL(10, 2),
        status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES sellers(user_id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
        INDEX idx_seller (seller_id),
        INDEX idx_warehouse (warehouse_id),
        INDEX idx_status (status)
      );
    `);

    console.log("✅ All tables initialized successfully");
  } catch (error: any) {
    console.error("❌ DB Initialization Error:", error.message);
    throw error; // Re-throw so server doesn't start with broken DB
  }
};