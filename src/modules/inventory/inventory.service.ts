import type { ResultSetHeader } from "mysql2";
import { pool } from "../../config/db";

const addInventory = async (payload: any, seller_id: string) => {
  const { warehouse_id, product_id, quantity } = payload;

  const [productRows]: any = await pool.query(
    `SELECT size, seller_id, name FROM products WHERE product_id = ?`,
    [product_id]
  );

  if (productRows.length === 0) throw new Error("Product not found");

  const product = productRows[0];

  if (String(product.seller_id) !== String(seller_id)) {
    throw new Error("You can only add inventory for your own products");
  }

  const productSize = parseFloat(product.size);

  const [rentRows]: any = await pool.query(
    `
    SELECT rent_id
    FROM rents
    WHERE warehouse_id = ?
      AND seller_id = ?
      AND status = 'active'
      AND start_date <= NOW()
      AND (end_date >= NOW() OR end_date IS NULL)
  `,
    [warehouse_id, seller_id]
  );

  if (rentRows.length === 0) {
    throw new Error(
      "You do not have an active rent for this warehouse. Please rent the facility first."
    );
  }

  const [warehouseRows]: any = await pool.query(
    `SELECT capacity FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  if (warehouseRows.length === 0) throw new Error("Warehouse not found");

  const maxCapacity = parseFloat(warehouseRows[0].capacity);

  const [usedRows]: any = await pool.query(
    `
    SELECT COALESCE(SUM(p.size * i.quantity), 0) as used
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    WHERE i.warehouse_id = ?
  `,
    [warehouse_id]
  );

  const currentUsed = parseFloat(usedRows[0].used);
  const neededSpace = productSize * quantity;

  if (currentUsed + neededSpace > maxCapacity) {
    throw new Error(
      `Not enough space! Available: ${(maxCapacity - currentUsed).toFixed(
        2
      )} sq ft, Required: ${neededSpace.toFixed(2)} sq ft`
    );
  }

  const [existingInv]: any = await pool.query(
    `SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?`,
    [warehouse_id, product_id]
  );

  if (existingInv.length > 0) {
    const newQuantity = existingInv[0].quantity + quantity;
    await pool.query(
      `UPDATE inventory SET quantity = ? WHERE inventory_id = ?`,
      [newQuantity, existingInv[0].inventory_id]
    );
    return existingInv[0].inventory_id;
  } else {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)`,
      [warehouse_id, product_id, quantity]
    );
    return result.insertId;
  }
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
    `
    SELECT 
      i.*,
      p.name as product_name,
      p.seller_id,
      w.location as warehouse_location
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE i.product_id=? AND i.warehouse_id=?
  `,
    [product_id, warehouse_id]
  );
  return result;
};

const getMyInventory = async (seller_id: string) => {
  const result = await pool.query(
    `
    SELECT 
      i.*,
      p.name as product_name,
      p.description as product_desc,
      p.image_url,
      p.price as unit_price,
      w.location as warehouse_location
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE p.seller_id = ?
    ORDER BY i.created_at DESC
  `,
    [seller_id]
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

  if (seller_id) {
    const [rows] = await pool.query(
      "SELECT seller_id FROM products WHERE product_id = ?",
      [product_id]
    );

    if ((rows as { seller_id: string }[]).length === 0) {
      throw new Error("Product not found");
    }

    const productSellerId = (rows as { seller_id: string }[])[0].seller_id;

    if (String(productSellerId) !== String(seller_id)) {
      throw new Error("Forbidden: you cannot update inventory for this product");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `
    UPDATE inventory 
    SET quantity=?, min_stock_level=?, max_stock_level=?, last_restocked=NOW()
    WHERE product_id=? AND warehouse_id=?
  `,
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
  getMyInventory,
  getSingleInventory,
  updateInventory,
  deleteInventory,
};
