import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addProduct = async (
  payload: Record<string, unknown>,
  seller_id: string
) => {
  const {
    name,
    description,
    price,
    category,
    brand,
    weight,
    size, 
    image_url,
    status,
  } = payload;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO products(seller_id, name, description, price, category, brand, weight, size, image_url, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seller_id,
      name,
      description,
      price,
      category,
      brand,
      weight,
      size, 
      image_url,
      status || "active",
    ]
  );

  return result.insertId;
};

const getProducts = async () => {
  const result = await pool.query(`
    SELECT 
      p.*,
      COALESCE(SUM(i.quantity), 0) as available_quantity,
      COUNT(DISTINCT i.warehouse_id) as warehouse_count
    FROM products p
    LEFT JOIN inventory i ON p.product_id = i.product_id
    GROUP BY p.product_id
  `);
  return result;
};

const getSingleProduct = async (product_id: string) => {
  const result = await pool.query(
    `SELECT 
      p.*,
      COALESCE(SUM(i.quantity), 0) as available_quantity,
      CONCAT('[', GROUP_CONCAT(
        JSON_OBJECT(
          'warehouse_id', i.warehouse_id,
          'quantity', i.quantity,
          'warehouse_location', w.location
        )
      ), ']') as inventory_details
    FROM products p
    LEFT JOIN inventory i ON p.product_id = i.product_id
    LEFT JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE p.product_id = ?
    GROUP BY p.product_id`,
    [product_id]
  );

  return result;
};

const getSellerProducts = async (seller_id: string) => {
  const result = await pool.query(
    `SELECT 
      p.*,
      COALESCE(SUM(i.quantity), 0) as available_quantity,
      COUNT(DISTINCT i.warehouse_id) as warehouse_count
    FROM products p
    LEFT JOIN inventory i ON p.product_id = i.product_id
    WHERE p.seller_id = ?
    GROUP BY p.product_id`,
    [seller_id]
  );
  return result;
};

const updateProduct = async (
  payload: Record<string, unknown>,
  product_id: string
) => {
  const {
    name,
    description,
    price,
    category,
    brand,
    weight,
    size, 
    image_url,
    status,
  } = payload;

  // Added size=? to query
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE products 
     SET name=?, description=?, price=?, category=?, brand=?, weight=?, size=?, image_url=?, status=? 
     WHERE product_id = ?`,
    [
      name,
      description,
      price,
      category,
      brand,
      weight,
      size,
      image_url,
      status,
      product_id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error("Product not found");
  }

  return result;
};

const deleteProduct = async (product_id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM products WHERE product_id=?`,
    [product_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no product found to delete!");
  }

  return result;
};

export const productService = {
  addProduct,
  getProducts,
  getSingleProduct,
  getSellerProducts,
  updateProduct,
  deleteProduct,
};