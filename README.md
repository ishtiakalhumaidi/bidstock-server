<div align="center">

# 📈 BidStock — Server

**B2B Wholesale Auction & Inventory Management API — Modular TypeScript Architecture, MySQL Connection Pooling, and Variadic RBAC**

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-5-000000?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql)](https://www.mysql.com/)
[![JWT](https://img.shields.io/badge/JWT_Auth-9-000000?logo=jsonwebtokens)](https://jwt.io/)

</div>

---

## 📋 Overview

BidStock Server is the API layer for a B2B wholesale auction and inventory management platform. Built with **Node.js**, **Express.js**, and **TypeScript**, it implements a **modular MVC architecture** across 10 business domains, a **variadic JWT auth middleware** supporting multi-role access control, **MySQL connection pooling** with `mysql2/promise`, and **programmatic database schema initialization** that creates all tables on application startup. The relational schema uses a **role-specific sub-table inheritance pattern** (users → buyers/sellers/warehouse_owners) with `ON DELETE CASCADE` referential integrity.

> 🔗 **Frontend Repo:** [bidstock-client](https://github.com/ishtiakalhumaidi/bidstock-client)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **🔐 Variadic JWT Auth Middleware** | `auth(...roles)` middleware supports zero or more role arguments — `auth()` allows any authenticated user, `auth("seller")` restricts to sellers, `auth("admin", "seller")` allows union access — with Bearer token format validation |
| **🎭 Four-Role Inheritance Schema** | Central `users` table with `role` CHECK constraint (`buyer`, `seller`, `warehouse_owner`, `admin`) and role-specific sub-tables (`buyers`, `sellers`, `warehouse_owners`) referencing `users.user_id` with `ON DELETE CASCADE` |
| **🏗️ Modular MVC Architecture** | 10 business modules — each with dedicated `routes.ts`, `controller.ts`, and `service.ts` files: Auth, Users, Products, Bids, Offers, Warehouses, Inventory, Transactions, Notifications, Rents |
| **📊 MySQL Connection Pooling** | `mysql2/promise` connection pool with `connectionLimit: 10`, `waitForConnections: true`, and automatic queue management for concurrent request handling |
| **🗄️ Programmatic Schema Initialization** | `initialDB()` function creates all 11 tables on application startup with `IF NOT EXISTS` guards — eliminates manual migration runs for fresh deployments |
| **🏭 Bid-Offer Separation Pattern** | `bids` table represents seller-created auctions (container), while `offers` table represents buyer bids on those auctions — enabling auction lifecycle management independent of individual bids |
| **💰 Multi-Party Transaction System** | `transactions` table uses `from_role`/`to_role` ENUMs (`buyer`, `seller`, `warehouse_owner`, `platform`) to support any payment direction — payments, refunds, commissions, and warehouse fees in a single table |
| **🔔 Notification System with Read Tracking** | `notifications` table with `is_read` boolean, `related_entity_type`/`related_entity_id` polymorphic references, and composite index `idx_user_read` for fast unread count queries |
| **📦 Composite Unique Inventory Keys** | `inventory` table enforces `UNIQUE KEY unique_product_warehouse (product_id, warehouse_id)` — preventing duplicate stock entries for the same product-warehouse pair |
| **🧾 Suspicious Bid Flagging** | `offers` table includes `is_suspicious` boolean and `flag_reason` text — enabling admin audit of unusual bidding patterns |
| **🏠 Warehouse Rental Lifecycle** | `rents` table tracks seller-warehouse rental agreements with `start_date`, `end_date`, and `status` ENUM (`active`, `completed`, `cancelled`) |
| **📈 Product Analytics Fields** | `products` table includes `rating`, `total_reviews`, and `total_sales` columns — denormalized for fast product listing queries without aggregation joins |

---

## 🛠️ Tech Stack

**Core**
- [Node.js](https://nodejs.org/) — Runtime
- [Express.js](https://expressjs.com/) — Web framework
- [TypeScript](https://www.typescriptlang.org/) — Type safety

**Database**
- [MySQL](https://www.mysql.com/) — Relational database
- [mysql2](https://www.npmjs.com/package/mysql2) — Promise-based MySQL driver with connection pooling

**Authentication**
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) — JWT signing and verification
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) — Password hashing

**Validation**
- [express-validator](https://express-validator.github.io/) — Request body validation (used in service layer)

**Build**
- [tsx](https://tsx.is/) — TypeScript execution for development with hot-reload (`tsx watch`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>= 18`
- MySQL `>= 8.0`
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/ishtiakalhumaidi/bidstock-server.git
cd bidstock-server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server with hot-reload
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bidstock_db

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Bcrypt
BCRYPT_SALT_ROUNDS=10
```

> ⚠️ **Never commit `.env` to version control.**

### Database Setup

The application automatically creates all tables on startup via `initialDB()`. No manual migration is required for fresh deployments:

```typescript
// src/config/db.ts
export const initialDB = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS buyers (...)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sellers (...)`);
  // ... 11 tables total
};
```

For existing databases, the `IF NOT EXISTS` guards ensure tables are only created when missing.

### Build for Production

```bash
# Compile TypeScript
npm run build

# Start production server
npm start
```

---

## 📁 Project Structure

```
bidstock-server/
├── src/
│   ├── app.ts                     # Express app configuration + route mounting
│   ├── server.ts                  # Bootstrap + server.listen()
│   ├── config/
│   │   ├── db.ts                  # MySQL pool + programmatic schema init
│   │   └── index.ts               # Environment config loader
│   ├── middleware/
│   │   └── auth.ts                # Variadic JWT + role verification
│   ├── modules/                   # 10 business modules (MVC pattern)
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── products/
│   │   │   ├── products.routers.ts
│   │   │   ├── products.controller.ts
│   │   │   └── products.service.ts
│   │   ├── bid/
│   │   │   ├── bids.route.ts
│   │   │   ├── bids.controller.ts
│   │   │   └── bids.service.ts
│   │   ├── offers/
│   │   │   ├── offers.routes.ts
│   │   │   ├── offers.controller.ts
│   │   │   └── offers.service.ts
│   │   ├── warehouses/
│   │   │   ├── warehouse.routes.ts
│   │   │   ├── warehouse.controller.ts
│   │   │   └── warehouse.service.ts
│   │   ├── inventory/
│   │   │   ├── inventory.routers.ts
│   │   │   ├── inventory.controller.ts
│   │   │   └── inventory.service.ts
│   │   ├── transactions/
│   │   │   ├── transactions.router.ts
│   │   │   ├── transactions.controller.ts
│   │   │   └── transactions.service.ts
│   │   ├── notifications/
│   │   │   ├── notifications.route.ts
│   │   │   ├── notifications.controller.ts
│   │   │   └── notifications.service.ts
│   │   └── rents/
│   │       ├── rent.routes.ts
│   │       ├── rent.controller.ts
│   │       └── rent.service.ts
│   └── types/
│       └── index.ts               # Global type definitions
├── database/
│   └── schema.sql                 # Standalone SQL schema backup
├── .env
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/auth/register` | Public | Register new user (role: buyer/seller/warehouse_owner) |
| `POST` | `/api/v1/auth/login` | Public | Login with email/password, returns JWT |
| `POST` | `/api/v1/auth/refresh` | Public | Refresh access token with refresh token |
| `POST` | `/api/v1/auth/logout` | Any | Invalidate refresh token |

### Users
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/api/v1/users/me` | Any | Get current user profile |
| `PUT` | `/api/v1/users/me` | Any | Update profile |
| `PUT` | `/api/v1/users/me/password` | Any | Change password |
| `GET` | `/api/v1/users` | Admin | List all users |
| `PUT` | `/api/v1/users/:userId/status` | Admin | Update user status (active/inactive/suspended) |
| `DELETE` | `/api/v1/users/:userId` | Admin | Delete user |

### Products
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/products` | Seller | Create product |
| `GET` | `/api/v1/products` | Public | List products (query: page, limit, minPrice, maxPrice) |
| `GET` | `/api/v1/products/:productId` | Public | Get product details |
| `PUT` | `/api/v1/products/:productId` | Seller | Update product |
| `DELETE` | `/api/v1/products/:productId` | Seller | Delete product |
| `GET` | `/api/v1/products/seller/:sellerId` | Public | Get products by seller |
| `GET` | `/api/v1/products/my-products` | Seller | Get current seller's products |

### Bids (Auctions)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/bids` | Seller | Create auction/bid container |
| `GET` | `/api/v1/bids` | Public | List all active bids |
| `GET` | `/api/v1/bids/:bidId` | Public | Get bid details |
| `GET` | `/api/v1/bids/my-bids` | Seller | Get seller's auctions |
| `PUT` | `/api/v1/bids/:bidId` | Seller | Update bid (e.g., close auction) |
| `DELETE` | `/api/v1/bids/:bidId` | Seller | Delete bid |

### Offers (Buyer Bids)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/offers` | Buyer | Place offer on a bid |
| `GET` | `/api/v1/offers/my-offers` | Buyer | Get buyer's offers |
| `GET` | `/api/v1/offers/bid/:bidId` | Any | Get offers on a specific bid |
| `PUT` | `/api/v1/offers/:offerId` | Buyer | Update pending offer |
| `PUT` | `/api/v1/offers/:offerId/status` | Seller | Accept/reject offer |
| `PUT` | `/api/v1/offers/:offerId/flag` | Admin | Flag suspicious offer |
| `DELETE` | `/api/v1/offers/:offerId` | Buyer | Delete pending offer |

### Warehouses
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/warehouses` | Warehouse Owner | Create warehouse |
| `GET` | `/api/v1/warehouses` | Public | List warehouses (query: location, minCapacity) |
| `GET` | `/api/v1/warehouses/:warehouseId` | Public | Get warehouse details |
| `GET` | `/api/v1/warehouses/my-warehouses` | Warehouse Owner | Get owner's warehouses |
| `PUT` | `/api/v1/warehouses/:warehouseId` | Warehouse Owner | Update warehouse |
| `DELETE` | `/api/v1/warehouses/:warehouseId` | Warehouse Owner | Delete warehouse |

### Inventory
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/inventories` | Seller/Warehouse Owner | Add product to warehouse |
| `GET` | `/api/v1/inventories/product/:productId` | Any | Get product inventory across warehouses |
| `GET` | `/api/v1/inventories/warehouse/:warehouseId` | Any | Get warehouse inventory |
| `PUT` | `/api/v1/inventories/:productId/:warehouseId` | Seller/Warehouse Owner | Update stock level |
| `DELETE` | `/api/v1/inventories/:productId/:warehouseId` | Seller/Warehouse Owner | Remove inventory entry |

### Transactions
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/transactions` | Any | Create transaction (payment/refund/commission/warehouse_fee) |
| `GET` | `/api/v1/transactions/my-transactions` | Any | Get user's transactions |
| `GET` | `/api/v1/transactions/:transactionId` | Any | Get transaction details |
| `GET` | `/api/v1/transactions` | Admin | List all platform transactions |
| `GET` | `/api/v1/transactions/bid/:bidId` | Any | Get transactions for a bid |

### Notifications
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/api/v1/notifications` | Any | Get user notifications (query: is_read, type) |
| `GET` | `/api/v1/notifications/unread-count` | Any | Get unread notification count |
| `PUT` | `/api/v1/notifications/:notificationId/read` | Any | Mark notification as read |
| `PUT` | `/api/v1/notifications/read-all` | Any | Mark all notifications as read |
| `DELETE` | `/api/v1/notifications/:notificationId` | Any | Delete notification |

### Rents
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/v1/rents` | Seller | Create rental agreement |
| `GET` | `/api/v1/rents/my-rentals` | Seller | Get seller's rentals |
| `GET` | `/api/v1/rents/warehouse/:warehouseId` | Warehouse Owner | Get rentals for a warehouse |
| `GET` | `/api/v1/rents/active` | Any | Get active rentals |
| `PUT` | `/api/v1/rents/:sellerId/:warehouseId/:startDate` | Seller | Update rental |
| `DELETE` | `/api/v1/rents/:sellerId/:warehouseId/:startDate` | Seller | Delete rental |

---

## 🔑 Key Architectural Decisions

### 1. Variadic Auth Middleware
The `auth` middleware uses TypeScript rest parameters for flexible role enforcement:

```typescript
// src/middleware/auth.ts
const auth = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = Jwt.verify(token, config.jwt_secret) as JwtPayload;
    req.user = decoded;

    // If roles specified, check membership
    if (roles.length > 0 && !roles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "forbidden: you don't have permission",
      });
    }

    next();
  };
};
```

**Usage patterns:**
```typescript
router.get("/my-bids", auth("seller"), bidsController.getMyBids);
router.get("/", auth("admin"), transactionsController.getTransactions);
router.get("/my-transactions", auth(), transactionsController.getMyTransactions);
```

- **`auth()`** — Any authenticated user (no role restriction)
- **`auth("seller")`** — Sellers only
- **`auth("admin", "seller")`** — Union access for admin and seller
- **Bearer format validation** — Checks `Authorization: Bearer <token>` structure

### 2. Role-Specific Sub-Table Inheritance
The schema implements a single-table inheritance pattern with role-specific sub-tables:

```sql
-- Central users table with role CHECK constraint
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(30) NOT NULL,
  CHECK (role IN ('buyer','seller','warehouse_owner','admin')),
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-specific sub-tables with CASCADE delete
CREATE TABLE buyers (
  user_id INT PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE sellers (
  user_id INT PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE warehouse_owners (
  user_id INT PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

**Benefits:**
- **Referential integrity** — Deleting a user automatically cleans up role-specific records
- **Extensibility** — New roles add a new sub-table without altering existing ones
- **Type safety** — The `CHECK` constraint prevents invalid role values at the database level

### 3. Bid-Offer Separation Pattern
The system separates auctions (bids) from individual buyer bids (offers):

```sql
-- Seller creates an auction container
CREATE TABLE bids (
  bid_id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  seller_id INT NOT NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  status ENUM('open', 'closed') DEFAULT 'open'
);

-- Buyers place offers on that auction
CREATE TABLE offers (
  offer_id INT PRIMARY KEY AUTO_INCREMENT,
  bid_id INT NOT NULL,
  buyer_id INT NOT NULL,
  offered_price DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  is_suspicious BOOLEAN DEFAULT FALSE,
  flag_reason TEXT
);
```

This design:
- **Decouples auction lifecycle from bids** — Closing a bid doesn't delete offer history
- **Enables offer comparison** — Sellers can compare all offers on a single bid
- **Supports audit trails** — `is_suspicious` and `flag_reason` enable fraud detection
- **Prevents N+1 queries** — One bid has many offers, efficiently queryable by `bid_id`

### 4. Multi-Party Transaction System
The transaction table supports any payment direction between platform participants:

```sql
CREATE TABLE transactions (
  transaction_id INT PRIMARY KEY AUTO_INCREMENT,
  bid_id INT,
  from_role ENUM('buyer', 'seller', 'warehouse_owner', 'platform') NOT NULL,
  from_id INT,
  to_role ENUM('buyer', 'seller', 'warehouse_owner', 'platform') NOT NULL,
  to_id INT,
  transaction_type ENUM('payment', 'refund', 'commission', 'warehouse_fee') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
  payment_method ENUM('bkash', 'nagad', 'card', 'bank', 'wallet')
);
```

**Use cases:**
- **Payment** — Buyer → Seller (product purchase)
- **Commission** — Seller → Platform (platform fee)
- **Warehouse Fee** — Seller → Warehouse Owner (rental payment)
- **Refund** — Platform → Buyer (dispute resolution)

The polymorphic `from_role`/`to_role` design eliminates the need for separate transaction tables per payment type.

### 5. Programmatic Schema Initialization
The database is initialized programmatically on application startup:

```typescript
// src/config/db.ts
export const initialDB = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (...)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS buyers (...)`);
  // ... all 11 tables
};
```

**Benefits:**
- **Zero-migration deployments** — Fresh instances self-initialize
- `IF NOT EXISTS` guards — Safe to run against existing databases
- **Version control** — Schema changes are tracked in Git alongside application code
- **No external migration tool** — Simplifies the deployment pipeline

### 6. MySQL Connection Pooling
The application uses a connection pool for efficient database access:

```typescript
export const pool = mysql.createPool({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  port: Number(config.db_port),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

**Configuration rationale:**
- **`connectionLimit: 10`** — Balances concurrent request handling with database load
- **`waitForConnections: true`** — Requests queue instead of failing when pool is exhausted
- **`queueLimit: 0`** — Unlimited queue depth prevents request loss under load spikes

### 7. Composite Unique Inventory Keys
The inventory table prevents duplicate stock entries:

```sql
CREATE TABLE inventory (
  inventory_id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  UNIQUE KEY unique_product_warehouse (product_id, warehouse_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE
);
```

This ensures a product can only have one inventory record per warehouse, preventing data inconsistency.

### 8. Notification Polymorphic References
The notification system uses generic entity references:

```sql
CREATE TABLE notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('bid_update', 'transaction', 'inventory_alert', 'system') NOT NULL,
  message TEXT NOT NULL,
  related_entity_type ENUM('bid', 'transaction', 'inventory', 'warehouse', 'system'),
  related_entity_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  INDEX idx_user_read (user_id, is_read)
);
```

The `related_entity_type` + `related_entity_id` pattern allows a single notification table to reference any business entity, with the composite index optimizing unread count queries.

---

## 🗺️ Roadmap

- [ ] **Database Migrations** — Replace programmatic initialization with a migration tool (e.g., `node-pg-migrate` or `db-migrate`) for production schema versioning
- [ ] **Input Validation Middleware** — Add `express-validator` at the route level for standardized request validation
- [ ] **Rate Limiting** — Integrate `express-rate-limit` on auth and bid endpoints
- [ ] **API Documentation** — OpenAPI/Swagger spec with auto-generation from TypeScript types
- [ ] **Testing Suite** — Jest + Supertest for controller and service layer coverage
- [ ] **Redis Caching** — Cache product listings and active bids
- [ ] **WebSockets** — Socket.io for real-time bid updates and notification push
- [ ] **Email Notifications** — Nodemailer integration for transactional emails
- [ ] **Payment Gateway** — Stripe or bKash/Nagad integration for transaction processing
- [ ] **Search & Filters** — Full-text search across products and warehouses
- [ ] **Analytics Dashboard** — SQL aggregation queries for seller revenue and platform metrics
- [ ] **Soft Deletes** — Replace hard deletes with `deleted_at` timestamps

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**📈 Where wholesale meets the auction floor**

Crafted by [Ishtiak Al Humaidi](https://github.com/ishtiakalhumaidi)

</div>
