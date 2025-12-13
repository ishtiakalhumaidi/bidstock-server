import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addProduct = async (payload: Record<string, unknown>) => {
  const {
    seller_id,
    name,
    description,
    price,
    quantity,
    category,
    brand,
    weight,
    image_url,
    status,
  } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `
    INSERT INTO products(seller_id, name, description, price, quantity, category, brand, weight, image_url, status) VALUES (?, ?, ?,?,?,?,?,?,?,?)
    `,
    [
      seller_id,
      name,
      description,
      price,
      quantity,
      category,
      brand,
      weight,
      image_url,
      status,
    ]
  );

  const insertId = result.insertId;

  return insertId;
};

const getProducts = async () => {
  const result = await pool.query(`SELECT * FROM products`);
  return result;
};

const getSingleProduct = async (product_id: string) => {
  const result = await pool.query(`SELECT * FROM products WHERE product_id=?`, [
    product_id,
  ]);

  return result;
};

const getSellerProducts = async (seller_id: string) => {
  const result = await pool.query(
    "SELECT * FROM products WHERE seller_id = ?",
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
    quantity,
    category,
    brand,
    weight,
    image_url,
    status,
  } = payload;
  const [result] = await pool.query<ResultSetHeader>(
    `
    UPDATE products SET name=?, description=?, price=?, quantity=?, category=?, brand=?, weight=?, image_url=?, status=? WHERE product_id = ?
    `,
    [
      name,
      description,
      price,
      quantity,
      category,
      brand,
      weight,
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
  const [result]: any = await pool.query(
    `
        DELETE FROM products WHERE product_id=?
        `,
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
