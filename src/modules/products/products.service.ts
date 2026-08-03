// products.service.ts
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db";
import { BadRequest, Forbidden, NotFound } from "../../utils/AppError";

interface ProductRow extends RowDataPacket {
  product_id: number;
  seller_id: number;
  name: string;
  price: number;
  status: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export interface GetProductsQuery {
  page?: number | string;
  limit?: number | string;
  category?: string;
  brand?: string;
  min_price?: number | string;
  max_price?: number | string;
  status?: "active" | "inactive" | "discontinued";
  search?: string;
}

const VALID_STATUSES = ["active", "inactive", "discontinued"];

// ---- Helpers -----------------------------------------------------------

const parsePagination = (page?: number | string, limit?: number | string) => {
  const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { pageNum, limitNum, offset };
};

// ---- Service methods -----------------------------------------------------

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
    length_cm,
    width_cm,
    height_cm,
    stackable,
    max_stack_count,
  } = payload;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw BadRequest("Product name is required");
  }
  if (name.trim().length > 255) {
    throw BadRequest("Product name must be 255 characters or less");
  }

  const productPrice = parseFloat(String(price));
  if (isNaN(productPrice) || productPrice <= 0) {
    throw BadRequest("Price must be a positive number");
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    throw BadRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  let lengthCm: number | null = null;
  if (length_cm !== undefined && length_cm !== null) {
    lengthCm = parseFloat(String(length_cm));
    if (isNaN(lengthCm) || lengthCm <= 0) {
      throw BadRequest("Length must be a positive number");
    }
  }

  let widthCm: number | null = null;
  if (width_cm !== undefined && width_cm !== null) {
    widthCm = parseFloat(String(width_cm));
    if (isNaN(widthCm) || widthCm <= 0) {
      throw BadRequest("Width must be a positive number");
    }
  }

  let heightCm: number | null = null;
  if (height_cm !== undefined && height_cm !== null) {
    heightCm = parseFloat(String(height_cm));
    if (isNaN(heightCm) || heightCm <= 0) {
      throw BadRequest("Height must be a positive number");
    }
  }

  let maxStackCount: number | null = null;
  if (max_stack_count !== undefined && max_stack_count !== null) {
    maxStackCount = parseInt(String(max_stack_count), 10);
    if (isNaN(maxStackCount) || maxStackCount < 1) {
      throw BadRequest("Max stack count must be at least 1");
    }
  }

  const isStackable = stackable === undefined ? true : Boolean(stackable);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO products(
      seller_id, name, description, price, category, brand, weight, size, image_url, status,
      length_cm, width_cm, height_cm, stackable, max_stack_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      lengthCm,
      widthCm,
      heightCm,
      isStackable,
      maxStackCount,
    ]
  );

  return result.insertId;
};

const getProducts = async (query: GetProductsQuery = {}) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [`p.status = 'active'`];
  const params: unknown[] = [];

  if (query.category) {
    whereClauses.push(`p.category = ?`);
    params.push(query.category);
  }
  if (query.brand) {
    whereClauses.push(`p.brand = ?`);
    params.push(query.brand);
  }
  if (query.min_price !== undefined) {
    whereClauses.push(`p.price >= ?`);
    params.push(Number(query.min_price));
  }
  if (query.max_price !== undefined) {
    whereClauses.push(`p.price <= ?`);
    params.push(Number(query.max_price));
  }
  if (query.search) {
    whereClauses.push(`p.name LIKE ?`);
    params.push(`%${query.search}%`);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM products p ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

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
    ${whereSQL}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `,
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

const getSellerProducts = async (
  seller_id: string,
  query: GetProductsQuery = {}
) => {
  const { pageNum, limitNum, offset } = parsePagination(query.page, query.limit);

  const whereClauses: string[] = [`p.seller_id = ?`];
  const params: unknown[] = [seller_id];

  if (query.category) {
    whereClauses.push(`p.category = ?`);
    params.push(query.category);
  }
  if (query.brand) {
    whereClauses.push(`p.brand = ?`);
    params.push(query.brand);
  }
  if (query.status) {
    whereClauses.push(`p.status = ?`);
    params.push(query.status);
  }
  if (query.min_price !== undefined) {
    whereClauses.push(`p.price >= ?`);
    params.push(Number(query.min_price));
  }
  if (query.max_price !== undefined) {
    whereClauses.push(`p.price <= ?`);
    params.push(Number(query.max_price));
  }
  if (query.search) {
    whereClauses.push(`p.name LIKE ?`);
    params.push(`%${query.search}%`);
  }

  const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) as count FROM products p ${whereSQL}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

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
    ${whereSQL}
    ORDER BY p.created_at DESC
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

const updateProduct = async (
  payload: Record<string, unknown>,
  product_id: string,
  user_id: number,
  user_role: string
) => {
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT * FROM products WHERE product_id = ?`,
    [product_id]
  );

  if (productRows.length === 0) {
    throw NotFound("Product not found");
  }

  const product = productRows[0]!;
  const isOwner = product.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not own this product");
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
    length_cm,
    width_cm,
    height_cm,
    stackable,
    max_stack_count,
  } = payload;

  let productPrice: number | null = null;
  if (price !== undefined) {
    productPrice = parseFloat(String(price));
    if (isNaN(productPrice) || productPrice <= 0) {
      throw BadRequest("Price must be a positive number");
    }
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw BadRequest("Product name cannot be empty");
    }
    if (name.trim().length > 255) {
      throw BadRequest("Product name must be 255 characters or less");
    }
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    throw BadRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  let lengthCm: number | null = null;
  if (length_cm !== undefined && length_cm !== null) {
    lengthCm = parseFloat(String(length_cm));
    if (isNaN(lengthCm) || lengthCm <= 0) {
      throw BadRequest("Length must be a positive number");
    }
  }

  let widthCm: number | null = null;
  if (width_cm !== undefined && width_cm !== null) {
    widthCm = parseFloat(String(width_cm));
    if (isNaN(widthCm) || widthCm <= 0) {
      throw BadRequest("Width must be a positive number");
    }
  }

  let heightCm: number | null = null;
  if (height_cm !== undefined && height_cm !== null) {
    heightCm = parseFloat(String(height_cm));
    if (isNaN(heightCm) || heightCm <= 0) {
      throw BadRequest("Height must be a positive number");
    }
  }

  let maxStackCount: number | null = null;
  if (max_stack_count !== undefined && max_stack_count !== null) {
    maxStackCount = parseInt(String(max_stack_count), 10);
    if (isNaN(maxStackCount) || maxStackCount < 1) {
      throw BadRequest("Max stack count must be at least 1");
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
          status = COALESCE(?, status),
         length_cm = COALESCE(?, length_cm),
         width_cm = COALESCE(?, width_cm),
         height_cm = COALESCE(?, height_cm),
         stackable = COALESCE(?, stackable),
         max_stack_count = COALESCE(?, max_stack_count)
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
      lengthCm,
      widthCm,
      heightCm,
      stackable !== undefined ? Boolean(stackable) : null,
      maxStackCount,
      product_id,
    ]
  );

  if (result.affectedRows === 0) {
    throw NotFound("Product not found");
  }

  return result;
};

const deleteProduct = async (
  product_id: string,
  user_id: number,
  user_role: string
) => {
  const [productRows] = await pool.query<ProductRow[]>(
    `SELECT * FROM products WHERE product_id = ?`,
    [product_id]
  );

  if (productRows.length === 0) {
    throw NotFound("Product not found");
  }

  const product = productRows[0]!;
  const isOwner = product.seller_id === user_id;
  const isAdmin = user_role === 'admin';

  if (!isOwner && !isAdmin) {
    throw Forbidden("Forbidden: You do not own this product");
  }

  const [bidRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM bids WHERE product_id = ? AND status = 'open'`,
    [product_id]
  );

  if ((bidRows[0]?.count ?? 0) > 0) {
    throw BadRequest("Cannot delete: This product has active auctions. Close them first.");
  }

  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM inventory WHERE product_id = ? AND quantity > 0`,
    [product_id]
  );

  if ((invRows[0]?.count ?? 0) > 0) {
    throw BadRequest("Cannot delete: This product still has inventory in stock. Remove inventory first.");
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM products WHERE product_id = ?`,
    [product_id]
  );

  if (result.affectedRows === 0) {
    throw NotFound("No product found to delete");
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