import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";

interface ProductRow extends RowDataPacket {
  product_id: number;
  seller_id: number;
  name: string;
  size: string | number | null;
  status: string;
}

interface WarehouseRow extends RowDataPacket {
  warehouse_id: number;
  owner_id: number;
  capacity: number;
}

interface InventoryRow extends RowDataPacket {
  inventory_id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  seller_id: number;
  owner_id: number;
}

interface RentRow extends RowDataPacket {
  rent_id: number;
}

const parseProductSize = (size: string | number | null | undefined): number => {
  if (size === null || size === undefined) return 1;
  const parsed = parseFloat(String(size));
  return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
};

const addInventory = async (payload: Record<string, unknown>, seller_id: number) => {
  const { warehouse_id, product_id, quantity } = payload;

  if (!warehouse_id || !product_id) {
    throw new Error("warehouse_id and product_id are required");
  }

  const qty = parseInt(quantity as string, 10);
  if (isNaN(qty) || qty <= 0) {
    throw new Error("Quantity must be a positive number");
  }

  // Verify product
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT product_id, seller_id, name, size, status FROM products WHERE product_id = ?`,
    [product_id]
  );

  if (productRows.length === 0) {
    throw new Error("Product not found");
  }

  const product = productRows[0]!; // Safe: length checked above

  if (product.status !== 'active') {
    throw new Error("Product is inactive");
  }

  if (product.seller_id !== seller_id) {
    throw new Error("Unauthorized: You can only add inventory for your own products");
  }

  // Verify active rent
  const [rentRows] = await pool.query<RentRow[]>(
    `SELECT rent_id FROM rents
     WHERE warehouse_id = ? AND seller_id = ? AND status = 'active'
       AND start_date <= CURDATE()
       AND (end_date >= CURDATE() OR end_date IS NULL)`,
    [warehouse_id, seller_id]
  );

  if (rentRows.length === 0) {
    throw new Error("You do not have an active rent for this warehouse");
  }

  // Verify warehouse
  const [warehouseRows] = await pool.query<WarehouseRow[]>(
    `SELECT capacity FROM warehouses WHERE warehouse_id = ?`,
    [warehouse_id]
  );

  if (warehouseRows.length === 0) {
    throw new Error("Warehouse not found");
  }

  const warehouse = warehouseRows[0]!; // Safe: length checked above
  const maxCapacity = parseFloat(String(warehouse.capacity)) || 0;

  // Calculate usage
  const [usedRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(i.quantity), 0) as used_qty
     FROM inventory i
     WHERE i.warehouse_id = ?`,
    [warehouse_id]
  );

  const currentUsedQty = parseInt(String(usedRows[0]?.used_qty ?? 0), 10);
  const newTotalQty = currentUsedQty + qty;

  if (newTotalQty > maxCapacity) {
    throw new Error(
      `Not enough warehouse capacity! Max: ${maxCapacity} units, Current: ${currentUsedQty}, Adding: ${qty}`
    );
  }

  // Upsert
  const [existingInv] = await pool.query<InventoryRow[]>(
    `SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?`,
    [warehouse_id, product_id]
  );

  if (existingInv.length > 0) {
    const existing = existingInv[0]!; // Safe: length checked
    const newQuantity = existing.quantity + qty;
    await pool.query<ResultSetHeader>(
      `UPDATE inventory SET quantity = ?, last_restocked = NOW() WHERE inventory_id = ?`,
      [newQuantity, existing.inventory_id]
    );
    return { inventory_id: existing.inventory_id, quantity: newQuantity, updated: true };
  } else {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)`,
      [warehouse_id, product_id, qty]
    );
    return { inventory_id: result.insertId, quantity: qty, updated: false };
  }
};

const getInventories = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT 
      i.*,
      p.name as product_name,
      p.seller_id,
      p.image_url,
      w.location as warehouse_location,
      w.owner_id,
      u.name as seller_name
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    JOIN users u ON p.seller_id = u.user_id
    ORDER BY i.created_at DESC
  `);
  return rows;
};

const getSingleInventory = async (product_id: string, warehouse_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT 
      i.*,
      p.name as product_name,
      p.seller_id,
      p.image_url,
      p.price as unit_price,
      w.location as warehouse_location,
      w.owner_id
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE i.product_id = ? AND i.warehouse_id = ?
    `,
    [product_id, warehouse_id]
  );
  return rows[0] ?? null;
};

const getMyInventory = async (seller_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT 
      i.*,
      p.name as product_name,
      p.description as product_desc,
      p.image_url,
      p.price as unit_price,
      w.location as warehouse_location,
      w.warehouse_id
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE p.seller_id = ?
    ORDER BY i.created_at DESC
  `,
    [seller_id]
  );
  return rows;
};

const updateInventory = async (
  payload: Record<string, unknown>,
  product_id: string,
  warehouse_id: string,
  user_id: number,
  user_role: string
) => {
  const { quantity, min_stock_level, max_stock_level } = payload;

  const [invRows] = await pool.query<InventoryRow[]>(
    `SELECT i.*, p.seller_id, w.owner_id 
     FROM inventory i
     JOIN products p ON i.product_id = p.product_id
     JOIN warehouses w ON i.warehouse_id = w.warehouse_id
     WHERE i.product_id = ? AND i.warehouse_id = ?`,
    [product_id, warehouse_id]
  );

  if (invRows.length === 0) {
    throw new Error("Inventory not found");
  }

  const inv = invRows[0]!; // Safe: length checked above

  const isOwner = 
    (user_role === "seller" && inv.seller_id === user_id) ||
    (user_role === "warehouse_owner" && inv.owner_id === user_id) ||
    (user_role === "admin");

  if (!isOwner) {
    throw new Error("Forbidden: You do not have permission to update this inventory");
  }

  if (quantity !== undefined) {
    const qty = parseInt(quantity as string, 10);
    if (isNaN(qty) || qty < 0) {
      throw new Error("Quantity must be 0 or greater");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE inventory 
     SET quantity = COALESCE(?, quantity),
         min_stock_level = COALESCE(?, min_stock_level),
         max_stock_level = COALESCE(?, max_stock_level),
         last_restocked = CASE WHEN ? IS NOT NULL THEN NOW() ELSE last_restocked END
     WHERE product_id = ? AND warehouse_id = ?`,
    [
      quantity ?? null,
      min_stock_level ?? null,
      max_stock_level ?? null,
      quantity ?? null,
      product_id,
      warehouse_id,
    ]
  );

  if (result.affectedRows === 0) {
    throw new Error("No inventory found to update");
  }

  return result;
};

const deleteInventory = async (
  product_id: string,
  warehouse_id: string,
  user_id: number,
  user_role: string
) => {
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, p.seller_id, w.owner_id 
     FROM inventory i
     JOIN products p ON i.product_id = p.product_id
     JOIN warehouses w ON i.warehouse_id = w.warehouse_id
     WHERE i.product_id = ? AND i.warehouse_id = ?`,
    [product_id, warehouse_id]
  );

  if (invRows.length === 0) {
    throw new Error("Inventory not found");
  }

  const inv = invRows[0]!; // Safe: length checked above

  const isOwner = 
    (user_role === "seller" && inv.seller_id === user_id) ||
    (user_role === "warehouse_owner" && inv.owner_id === user_id) ||
    (user_role === "admin");

  if (!isOwner) {
    throw new Error("Forbidden: You do not have permission to delete this inventory");
  }

  const [txRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as tx_count FROM transactions 
     WHERE bid_id IN (SELECT bid_id FROM bids WHERE product_id = ?) 
     AND status = 'pending'`,
    [product_id]
  );

  if ((txRows[0]?.tx_count ?? 0) > 0) {
    throw new Error("Cannot delete: There are pending transactions for this product");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM inventory WHERE product_id = ? AND warehouse_id = ?`,
    [product_id, warehouse_id]
  );

  if (result.affectedRows === 0) {
    throw new Error("No inventory found to delete");
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