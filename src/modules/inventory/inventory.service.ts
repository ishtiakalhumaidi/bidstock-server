// inventory.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { notificationsService } from "../notifications/notifications.service";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

interface ProductRow extends RowDataPacket {
  product_id: number;
  seller_id: number;
  name: string;
  size: string | number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  stackable: boolean;
  max_stack_count: number | null;
  status: string;
}

interface InventorySpaceRow extends RowDataPacket {
  product_id: number;
  quantity: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  stackable: boolean;
  max_stack_count: number | null;
}

interface WarehouseRow extends RowDataPacket {
  warehouse_id: number;
  owner_id: number;
  capacity: number;
  floor_area_sqm: number | null;
  ceiling_height_m: number | null;
}

interface InventoryRow extends RowDataPacket {
  inventory_id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  seller_id: number;
  owner_id: number;
  product_name?: string;
  min_stock_level: number;
}

interface RentRow extends RowDataPacket {
  rent_id: number;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetInventoriesQuery {
  page?: number | string;
  limit?: number | string;
  warehouse_id?: number | string;
  product_id?: number | string;
  low_stock?: boolean | string;
}

export interface GetWarehouseOwnerInventoryQuery {
  page?: number | string;
  limit?: number | string;
  warehouse_id?: string;
  product_id?: string;
  search?: string;
  min_quantity?: number | string;
}

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(
    100,
    Math.max(1, parseInt(String(limit ?? 20), 10) || 20),
  );
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

const DEFAULT_DIM_CM = 30;

const calculateSpaceUsed = (
  product: Pick<
    ProductRow,
    "length_cm" | "width_cm" | "height_cm" | "stackable" | "max_stack_count"
  >,
  quantity: number,
  ceilingHeightM: number,
): number => {
  const lengthCm = product.length_cm ?? DEFAULT_DIM_CM;
  const widthCm = product.width_cm ?? DEFAULT_DIM_CM;
  const heightCm = product.height_cm ?? DEFAULT_DIM_CM;

  const footprintSqm = (lengthCm / 100) * (widthCm / 100);

  let stackCount = 1;
  if (product.stackable) {
    const heightM = heightCm / 100;
    const byCeiling = heightM > 0 ? Math.floor(ceilingHeightM / heightM) : 1;
    const byMax = product.max_stack_count ?? Infinity;
    stackCount = Math.max(1, Math.min(byCeiling, byMax));
  }

  return Math.ceil(quantity / stackCount) * footprintSqm;
};

const computeWarehouseUtilization = async (
  warehouse: Pick<WarehouseRow, "floor_area_sqm" | "ceiling_height_m">,
  warehouse_id: number | string,
  forProductId?: number | string,
  additionalQty: number = 0,
): Promise<{
  usedSqm: number;
  totalSqm: number;
  remainingSqm: number;
} | null> => {
  if (
    warehouse.floor_area_sqm === null ||
    warehouse.floor_area_sqm === undefined
  ) {
    return null;
  }

  const ceilingHeightM = warehouse.ceiling_height_m ?? 3;

  const [rows] = await pool.query<InventorySpaceRow[]>(
    `SELECT i.product_id, i.quantity,
            p.length_cm, p.width_cm, p.height_cm, p.stackable, p.max_stack_count
     FROM inventory i
     JOIN products p ON i.product_id = p.product_id
     WHERE i.warehouse_id = ?
     FOR UPDATE`,
    [warehouse_id],
  );

  let usedSqm = 0;
  let matchedExistingRow = false;

  for (const row of rows) {
    let qty = row.quantity;
    if (
      forProductId !== undefined &&
      String(row.product_id) === String(forProductId)
    ) {
      qty += additionalQty;
      matchedExistingRow = true;
    }
    usedSqm += calculateSpaceUsed(row, qty, ceilingHeightM);
  }

  if (forProductId !== undefined && !matchedExistingRow && additionalQty > 0) {
    const [productRows] = await pool.query<ProductRow[]>(
      `SELECT length_cm, width_cm, height_cm, stackable, max_stack_count FROM products WHERE product_id = ?`,
      [forProductId],
    );
    if (productRows[0]) {
      usedSqm += calculateSpaceUsed(
        productRows[0],
        additionalQty,
        ceilingHeightM,
      );
    }
  }

  const totalSqm = warehouse.floor_area_sqm;
  return { usedSqm, totalSqm, remainingSqm: totalSqm - usedSqm };
};

// ---- Service methods -----------------------------------------------------

const getAvailableStock = async (
  product_id: number | string,
  seller_id: number | string,
): Promise<number> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(i.quantity), 0) as total
     FROM inventory i
     JOIN rents r ON i.warehouse_id = r.warehouse_id
     WHERE i.product_id = ?
       AND r.seller_id = ?
       AND r.status = 'active'
       AND r.start_date <= CURDATE()
       AND (r.end_date >= CURDATE() OR r.end_date IS NULL)`,
    [product_id, seller_id],
  );

  return parseInt(String(rows[0]?.total ?? 0), 10);
};

const addInventory = async (
  payload: Record<string, unknown>,
  seller_id: number,
) => {
  const { warehouse_id, product_id, quantity } = payload;

  if (!warehouse_id || !product_id) {
    throw BadRequest("warehouse_id and product_id are required");
  }

  const qty = parseInt(quantity as string, 10);
  if (isNaN(qty) || qty <= 0) {
    throw BadRequest("Quantity must be a positive number");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [productRows] = await connection.query<ProductRow[]>(
      `SELECT product_id, seller_id, name, size, length_cm, width_cm, height_cm, stackable, max_stack_count, status
        FROM products WHERE product_id = ?`,
      [product_id],
    );

    if (productRows.length === 0) {
      throw NotFound("Product not found");
    }

    const product = productRows[0]!;
    if (product.status !== "active") {
      throw NotFound("Product is inactive");
    }

    if (product.seller_id !== seller_id) {
      throw Forbidden(
        "Unauthorized: You can only add inventory for your own products",
      );
    }

    const [rentRows] = await connection.query<RentRow[]>(
      `SELECT rent_id FROM rents
       WHERE warehouse_id = ? AND seller_id = ? AND status = 'active'
         AND start_date <= CURDATE()
         AND (end_date >= CURDATE() OR end_date IS NULL)`,
      [warehouse_id, seller_id],
    );

    if (rentRows.length === 0) {
      throw Forbidden("You do not have an active rent for this warehouse");
    }

    const [warehouseRows] = await connection.query<WarehouseRow[]>(
      `SELECT capacity, floor_area_sqm, ceiling_height_m FROM warehouses WHERE warehouse_id = ? FOR UPDATE`,
      [warehouse_id],
    );

    if (warehouseRows.length === 0) {
      throw NotFound("Warehouse not found");
    }

    const warehouse = warehouseRows[0]!;

    const utilization = await computeWarehouseUtilization(
      warehouse,
      warehouse_id as string,
      product_id as string,
      qty,
    );

    if (utilization) {
      if (utilization.remainingSqm < 0) {
        throw BadRequest(
          `Not enough warehouse floor space! Total: ${utilization.totalSqm.toFixed(2)} sqm, ` +
            `Would use: ${utilization.usedSqm.toFixed(2)} sqm ` +
            `(over by ${Math.abs(utilization.remainingSqm).toFixed(2)} sqm). ` +
            `Reduce quantity or use a larger warehouse.`,
        );
      }
    } else {
      const maxCapacity = parseFloat(String(warehouse.capacity)) || 0;
      const [usedRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(i.quantity), 0) as used_qty
         FROM inventory i
         WHERE i.warehouse_id = ?
         FOR UPDATE`,
        [warehouse_id],
      );

      const currentUsedQty = parseInt(String(usedRows[0]?.used_qty ?? 0), 10);
      const newTotalQty = currentUsedQty + qty;

      if (newTotalQty > maxCapacity) {
        throw BadRequest(
          `Not enough warehouse capacity! Max: ${maxCapacity} units, Current: ${currentUsedQty}, Adding: ${qty}. ` +
            `(This warehouse hasn't set a floor area yet, so capacity is still tracked by unit count   ` +
            `ask the warehouse owner to set floor_area_sqm for accurate space-based tracking.)`,
        );
      }
    }

    const [existingInv] = await connection.query<InventoryRow[]>(
      `SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? FOR UPDATE`,
      [warehouse_id, product_id],
    );

    let resultData: {
      inventory_id: number;
      quantity: number;
      updated: boolean;
    };

    if (existingInv.length > 0) {
      const existing = existingInv[0]!;
      const newQuantity = existing.quantity + qty;
      await connection.query<ResultSetHeader>(
        `UPDATE inventory SET quantity = ?, last_restocked = NOW() WHERE inventory_id = ?`,
        [newQuantity, existing.inventory_id],
      );
      resultData = {
        inventory_id: existing.inventory_id,
        quantity: newQuantity,
        updated: true,
      };
    } else {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)`,
        [warehouse_id, product_id, qty],
      );
      resultData = {
        inventory_id: result.insertId,
        quantity: qty,
        updated: false,
      };
    }

    await connection.commit();
    return resultData;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getInventories = async (query: GetInventoriesQuery = {}) => {
  const { pageNum, limitNum, offset } = parsePagination(
    query.page,
    query.limit,
  );

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query.warehouse_id) {
    whereClauses.push(`i.warehouse_id = ?`);
    params.push(query.warehouse_id);
  }
  if (query.product_id) {
    whereClauses.push(`i.product_id = ?`);
    params.push(query.product_id);
  }
  if (query.low_stock === true || query.low_stock === "true") {
    whereClauses.push(`i.quantity <= i.min_stock_level`);
  }

  const whereSQL = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : "";

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM inventory i ${whereSQL}`,
    params,
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
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
    ${whereSQL}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const getSingleInventory = async (product_id: string, warehouse_id: string) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      i.*, p.name as product_name, p.seller_id, p.image_url, p.price as unit_price,
      w.location as warehouse_location, w.owner_id
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE i.product_id = ? AND i.warehouse_id = ?`,
    [product_id, warehouse_id],
  );

  return rows[0] ?? null;
};

const getMyInventory = async (
  seller_id: string,
  query: GetInventoriesQuery = {},
) => {
  const { pageNum, limitNum, offset } = parsePagination(
    query.page,
    query.limit,
  );

  const whereClauses: string[] = [`p.seller_id = ?`];
  const params: unknown[] = [seller_id];

  if (query.warehouse_id) {
    whereClauses.push(`i.warehouse_id = ?`);
    params.push(query.warehouse_id);
  }
  if (query.product_id) {
    whereClauses.push(`i.product_id = ?`);
    params.push(query.product_id);
  }
  if (query.low_stock === true || query.low_stock === "true") {
    whereClauses.push(`i.quantity <= i.min_stock_level`);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM inventory i JOIN products p ON i.product_id = p.product_id ${whereSQL}`,
    params,
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      i.*, p.name as product_name, p.description as product_desc, p.image_url, p.price as unit_price,
      w.location as warehouse_location, w.warehouse_id
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    ${whereSQL}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const getWarehouseOwnerInventory = async (
  owner_id: string,
  query: GetWarehouseOwnerInventoryQuery = {},
) => {
  const { pageNum, limitNum, offset } = parsePagination(
    query.page,
    query.limit,
  );

  const whereClauses: string[] = [`w.owner_id = ?`];
  const params: unknown[] = [owner_id];

  if (query.warehouse_id) {
    whereClauses.push(`i.warehouse_id = ?`);
    params.push(query.warehouse_id);
  }
  if (query.product_id) {
    whereClauses.push(`i.product_id = ?`);
    params.push(query.product_id);
  }
  if (query.min_quantity !== undefined) {
    whereClauses.push(`i.quantity >= ?`);
    params.push(Number(query.min_quantity));
  }
  if (query.search) {
    whereClauses.push(`(p.name LIKE ? OR su.name LIKE ?)`);
    params.push(`%${query.search}%`, `%${query.search}%`);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count
      FROM inventory i
     JOIN warehouses w ON i.warehouse_id = w.warehouse_id
     JOIN products p ON i.product_id = p.product_id
     JOIN users su ON p.seller_id = su.user_id
     ${whereSQL}`,
    params,
  );
  const total = countRows[0]?.count ?? 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      i.inventory_id, i.warehouse_id, i.quantity,
      w.location as warehouse_location,
      su.user_id as seller_id, su.name as seller_name, su.email as seller_email,
      su.phone as seller_phone, su.user_image as seller_image
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    JOIN products p ON i.product_id = p.product_id
    JOIN users su ON p.seller_id = su.user_id
    ${whereSQL}
    ORDER BY i.warehouse_id ASC, su.name ASC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

const updateInventory = async (
  payload: Record<string, unknown>,
  product_id: string,
  warehouse_id: string,
  user_id: number,
  user_role: string,
) => {
  const { quantity, min_stock_level, max_stock_level } = payload;

  const [invRows] = await pool.query<InventoryRow[]>(
    `SELECT i.*, p.seller_id, p.name AS product_name, w.owner_id
      FROM inventory i
     JOIN products p ON i.product_id = p.product_id
     JOIN warehouses w ON i.warehouse_id = w.warehouse_id
     WHERE i.product_id = ? AND i.warehouse_id = ?`,
    [product_id, warehouse_id],
  );

  if (invRows.length === 0) {
    throw NotFound("Inventory not found");
  }

  const inv = invRows[0]!;

  const isOwner =
    (user_role === "seller" && inv.seller_id === user_id) ||
    (user_role === "warehouse_owner" && inv.owner_id === user_id) ||
    user_role === "admin";

  if (!isOwner) {
    throw Forbidden(
      "Forbidden: You do not have permission to update this inventory",
    );
  }

  if (quantity !== undefined) {
    const qty = parseInt(quantity as string, 10);
    if (isNaN(qty) || qty < 0) {
      throw BadRequest("Quantity must be 0 or greater");
    }

    if (qty > inv.quantity) {
      const [warehouseRows] = await pool.query<WarehouseRow[]>(
        `SELECT capacity, floor_area_sqm, ceiling_height_m FROM warehouses WHERE warehouse_id = ?`,
        [warehouse_id],
      );
      const warehouse = warehouseRows[0];

      if (warehouse) {
        const delta = qty - inv.quantity;
        const utilization = await computeWarehouseUtilization(
          warehouse,
          warehouse_id,
          product_id,
          delta,
        );

        if (utilization && utilization.remainingSqm < 0) {
          throw BadRequest(
            `Not enough warehouse floor space to increase quantity! ` +
              `Total: ${utilization.totalSqm.toFixed(2)} sqm, Would use: ${utilization.usedSqm.toFixed(2)} sqm.`,
          );
        }
      }
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
    ],
  );

  if (result.affectedRows === 0) {
    throw NotFound("No inventory found to update");
  }

  if (quantity !== undefined) {
    const newQty = parseInt(quantity as string, 10);
    const minLevel =
      min_stock_level !== undefined
        ? parseInt(min_stock_level as string, 10)
        : inv.min_stock_level;

    if (newQty <= minLevel) {
      try {
        await notificationsService.notifyLowStock({
          seller_id: inv.seller_id,
          product_name: inv.product_name ?? "your product",
          quantity: newQty,
          min_stock_level: minLevel,
          inventory_id: inv.inventory_id,
        });
      } catch (notifErr) {
        console.error("Low stock notification failed:", notifErr);
      }
    }
  }

  return result;
};

const deleteInventory = async (
  product_id: string,
  warehouse_id: string,
  user_id: number,
  user_role: string,
) => {
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, p.seller_id, w.owner_id
      FROM inventory i
     JOIN products p ON i.product_id = p.product_id
     JOIN warehouses w ON i.warehouse_id = w.warehouse_id
     WHERE i.product_id = ? AND i.warehouse_id = ?`,
    [product_id, warehouse_id],
  );

  if (invRows.length === 0) {
    throw NotFound("Inventory not found");
  }

  const inv = invRows[0]!;

  const isOwner =
    (user_role === "seller" && inv.seller_id === user_id) ||
    (user_role === "warehouse_owner" && inv.owner_id === user_id) ||
    user_role === "admin";

  if (!isOwner) {
    throw Forbidden(
      "Forbidden: You do not have permission to delete this inventory",
    );
  }

  const [txRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as tx_count FROM transactions
      WHERE bid_id IN (SELECT bid_id FROM bids WHERE product_id = ?)
      AND status = 'pending'`,
    [product_id],
  );

  if ((txRows[0]?.tx_count ?? 0) > 0) {
    throw BadRequest(
      "Cannot delete: There are pending transactions for this product",
    );
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM inventory WHERE product_id = ? AND warehouse_id = ?`,
    [product_id, warehouse_id],
  );

  if (result.affectedRows === 0) {
    throw NotFound("No inventory found to delete");
  }

  return result;
};

export const inventoryService = {
  addInventory,
  getInventories,
  getMyInventory,
  getSingleInventory,
  getWarehouseOwnerInventory,
  getAvailableStock,
  computeWarehouseUtilization,
  updateInventory,
  deleteInventory,
};