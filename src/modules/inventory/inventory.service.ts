import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addInventory = async (payload: Record<string, unknown>) => {
  const { 
    product_id, 
    warehouse_id, 
    quantity, 
    min_stock_level, 
    max_stock_level 
  } = payload;

  // Check if seller has rented this warehouse
  const [productRows] = await pool.query(
    `SELECT seller_id FROM products WHERE product_id = ?`,
    [product_id]
  );

  if ((productRows as any[]).length === 0) {
    throw new Error("Product not found");
  }

  const sellerId = (productRows as any[])[0].seller_id;

  const [rentRows] = await pool.query(
    `SELECT * FROM rents 
     WHERE seller_id = ? AND warehouse_id = ? AND status = 'active'`,
    [sellerId, warehouse_id]
  );

  if ((rentRows as any[]).length === 0) {
    throw new Error("Seller must rent this warehouse before adding inventory");
  }

  // Add inventory
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory(product_id, warehouse_id, quantity, min_stock_level, max_stock_level, last_restocked)
     VALUES(?, ?, ?, ?, ?, NOW())`,
    [
      product_id, 
      warehouse_id, 
      quantity ?? 0, 
      min_stock_level ?? 10, 
      max_stock_level ?? 1000
    ]
  );

  return result;
};

const getInventories = async () => {
  const result = await pool.query(`
    SELECT 
      i.*,
      p.name as product_name,
      p.seller_id,
      w.location as warehouse_location,
      w.owner_id
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
  `);
  return result;
};

const getSingleInventory = async (product_id: string, warehouse_id: string) => {
  const result = await pool.query(
    `SELECT 
      i.*,
      p.name as product_name,
      p.seller_id,
      w.location as warehouse_location
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE i.product_id=? AND i.warehouse_id=?`,
    [product_id, warehouse_id]
  );
  return result;
};

const updateInventory = async (
  payload: Record<string, unknown>,
  product_id: string,
  warehouse_id: string,
  seller_id?: string
) => {
  const { quantity, min_stock_level, max_stock_level } = payload;

  // Verify seller owns this product
  if (seller_id) {
    const [rows] = await pool.query(
      "SELECT seller_id FROM products WHERE product_id = ?",
      [product_id]
    );

    if ((rows as { seller_id: string }[]).length === 0) {
      throw new Error("Product not found");
    }

    const productSellerId = (rows as { seller_id: string }[])[0].seller_id;

    if (productSellerId !== seller_id) {
      throw new Error("Forbidden: you cannot update inventory for this product");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE inventory 
     SET quantity=?, min_stock_level=?, max_stock_level=?, last_restocked=NOW()
     WHERE product_id=? AND warehouse_id=?`,
    [quantity, min_stock_level, max_stock_level, product_id, warehouse_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no inventory found to update");
  }

  return result;
};

const deleteInventory = async (product_id: string, warehouse_id: string) => {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM inventory WHERE product_id=? AND warehouse_id=?`,
    [product_id, warehouse_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("no inventory found to delete");
  }

  return result;
};

export const inventoryService = {
  addInventory,
  getInventories,
  getSingleInventory,
  updateInventory,
  deleteInventory,
};