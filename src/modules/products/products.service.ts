import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

interface ProductRow extends RowDataPacket {
  product_id: number;
  seller_id: number;
  name: string;
  price: number;
  status: string;
}

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

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error("Product name is required");
  }
  if (name.trim().length > 255) {
    throw new Error("Product name must be 255 characters or less");
  }

  const productPrice = parseFloat(String(price));
  if (isNaN(productPrice) || productPrice <= 0) {
    throw new Error("Price must be a positive number");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO products(seller_id, name, description, price, category, brand, weight, size, image_url, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seller_id,
      name.toString().trim(),
      description ?? null,
      productPrice,
      category ?? null,
      brand ?? null,
      weight ?? null,
      size ?? null,
      image_url ?? null,
      status || "active",
    ]
  );

  return result.insertId;
};

const getProducts = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      p.*,
      COALESCE(inv.available_quantity, 0) as available_quantity,
      COALESCE(inv.warehouse_count, 0) as warehouse_count
    FROM products p
    LEFT JOIN (
      SELECT 
        product_id, 
        COALESCE(SUM(quantity), 0) as available_quantity,
        COUNT(DISTINCT warehouse_id) as warehouse_count
      FROM inventory
      GROUP BY product_id
    ) inv ON p.product_id = inv.product_id
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC
    LIMIT 100
  `);
  return rows;
};

const getSingleProduct = async (product_id: string) => {
  const [productRows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*, COALESCE(inv.available_quantity, 0) as available_quantity
     FROM products p
     LEFT JOIN (
       SELECT product_id, COALESCE(SUM(quantity), 0) as available_quantity
       FROM inventory
       GROUP BY product_id
     ) inv ON p.product_id = inv.product_id
     WHERE p.product_id = ?`,
    [product_id]
  );

  if (productRows.length === 0) return null;

  const product = productRows[0] as any;

  // Fetch inventory details separately (avoids GROUP BY issues)
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.warehouse_id, i.quantity, w.location as warehouse_location
     FROM inventory i
     JOIN warehouses w ON i.warehouse_id = w.warehouse_id
     WHERE i.product_id = ? AND i.quantity > 0`,
    [product_id]
  );

  product.inventory_details = invRows;
  product.warehouse_count = invRows.length;

  return product;
};

const getSellerProducts = async (seller_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      p.*,
      COALESCE(inv.available_quantity, 0) as available_quantity,
      COALESCE(inv.warehouse_count, 0) as warehouse_count
    FROM products p
    LEFT JOIN (
      SELECT 
        product_id, 
        COALESCE(SUM(quantity), 0) as available_quantity,
        COUNT(DISTINCT warehouse_id) as warehouse_count
      FROM inventory
      GROUP BY product_id
    ) inv ON p.product_id = inv.product_id
    WHERE p.seller_id = ?
    ORDER BY p.created_at DESC`,
    [seller_id]
  );
  return rows;
};

const updateProduct = async (
  payload: Record<string, unknown>,
  product_id: string,
  user_id: number,
  user_role: string
) => {
  // Verify ownership
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT * FROM products WHERE product_id = ?`,
    [product_id]
  );
  if (productRows.length === 0) {
    throw new Error("Product not found");
  }

  const product = productRows[0]!;
  const isOwner = product.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not own this product");
  }

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

  // Validate price if provided
  let productPrice: number | null = null;
  if (price !== undefined) {
    productPrice = parseFloat(String(price));
    if (isNaN(productPrice) || productPrice <= 0) {
      throw new Error("Price must be a positive number");
    }
  }

  // Validate name if provided
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error("Product name cannot be empty");
    }
    if (name.trim().length > 255) {
      throw new Error("Product name must be 255 characters or less");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE products 
     SET name = COALESCE(?, name), 
         description = COALESCE(?, description), 
         price = COALESCE(?, price), 
         category = COALESCE(?, category), 
         brand = COALESCE(?, brand), 
         weight = COALESCE(?, weight), 
         size = COALESCE(?, size), 
         image_url = COALESCE(?, image_url), 
         status = COALESCE(?, status)
     WHERE product_id = ?`,
    [
      name !== undefined ? name.toString().trim() : null,
      description !== undefined ? description : null,
      productPrice,
      category !== undefined ? category : null,
      brand !== undefined ? brand : null,
      weight !== undefined ? weight : null,
      size !== undefined ? size : null,
      image_url !== undefined ? image_url : null,
      status !== undefined ? status : null,
      product_id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error("Product not found");
  }

  return result;
};

const deleteProduct = async (
  product_id: string,
  user_id: number,
  user_role: string
) => {
  // Verify ownership
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT * FROM products WHERE product_id = ?`,
    [product_id]
  );
  if (productRows.length === 0) {
    throw new Error("Product not found");
  }

  const product = productRows[0]!;
  const isOwner = product.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error("Forbidden: You do not own this product");
  }

  // Check for active bids
  const [bidRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM bids WHERE product_id = ? AND status = 'open'`,
    [product_id]
  );
  if ((bidRows[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete: This product has active auctions. Close them first.");
  }

  // Check for active inventory
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM inventory WHERE product_id = ? AND quantity > 0`,
    [product_id]
  );
  if ((invRows[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete: This product still has inventory in stock. Remove inventory first.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM products WHERE product_id = ?`,
    [product_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No product found to delete");
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