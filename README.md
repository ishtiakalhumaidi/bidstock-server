# BidStock Backend Server

A comprehensive bidding platform backend built with Node.js, TypeScript, Express, JWT authentication, and MySQL. BidStock connects buyers, sellers, and warehouse owners in a secure marketplace environment.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)

## ✨ Features

- **Multi-role Authentication**: Support for Buyers, Sellers, Warehouse Owners, and Admins
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Product Management**: CRUD operations for products with seller association
- **Bidding System**: Real-time bidding with suspicious activity flagging
- **Warehouse Management**: Inventory tracking across multiple warehouses
- **Transaction Processing**: Complete payment, refund, and commission handling
- **Notification System**: Real-time notifications for all user activities
- **Warehouse Rental**: Rental management system for sellers

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: express-validator
- **Environment Management**: dotenv

## 📁 Project Structure

```
bidstock-server/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── products/
│   │   │   ├── products.routes.ts
│   │   │   ├── products.controller.ts
│   │   │   └── products.service.ts
│   │   ├── bids/
│   │   │   ├── bids.routes.ts
│   │   │   ├── bids.controller.ts
│   │   │   └── bids.service.ts
│   │   ├── warehouses/
│   │   │   ├── warehouses.routes.ts
│   │   │   ├── warehouses.controller.ts
│   │   │   └── warehouses.service.ts
│   │   ├── inventory/
│   │   │   ├── inventory.routes.ts
│   │   │   ├── inventory.controller.ts
│   │   │   └── inventory.service.ts
│   │   ├── transactions/
│   │   │   ├── transactions.routes.ts
│   │   │   ├── transactions.controller.ts
│   │   │   └── transactions.service.ts
│   │   ├── notifications/
│   │   │   ├── notifications.routes.ts
│   │   │   ├── notifications.controller.ts
│   │   │   └── notifications.service.ts
│   │   └── rents/
│   │       ├── rents.routes.ts
│   │       ├── rents.controller.ts
│   │       └── rents.service.ts
│   ├── middleware/
│   ├── config/
│   │   ├─── db.ts
│   │   └─── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── app.ts
│   └── server.ts
├── database/
│   └── schema.sql
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 📦 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn
- Git

## 🚀 Installation

1. **Clone the repository**
```bash
git clone https://github.com/ishtiakalhumaidi/bidstock-server.git
cd bidstock-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env
```

4. **Configure environment variables** (see [Environment Variables](#environment-variables))

5. **Setup database** (see [Database Setup](#database-setup))

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bidstock_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this

# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=10

```

## 💾 Database Setup

1. **Create the database**
```bash
mysql -u root -p
```

2. **Run the SQL schema**

```sql
CREATE DATABASE bidstock_db;
USE bidstock_db;

-- Then run all your CREATE TABLE statements
```

Or use the provided SQL file:
```bash
mysql -u root -p bidstock_db < database/schema.sql
```

## ▶️ Running the Application

**Development mode with hot-reload:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Run production build:**
```bash
npm start
```

**Run tests:**
```bash
npm test
```

## 📚 API Documentation

Base URL: `http://localhost:5000/api/v1`

### Authentication Routes

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "phone": "+1234567890",
  "role": "buyer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "role": "buyer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer {token}
```

---

### User Routes

#### Get Current User Profile
```http
GET /api/v1/users/me
Authorization: Bearer {token}
```

#### Update Profile
```http
PUT /api/v1/users/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Updated",
  "phone": "+1234567890"
}
```

#### Change Password
```http
PUT /api/v1/users/me/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword123"
}
```

#### Get All Users (Admin only)
```http
GET /api/v1/users
Authorization: Bearer {token}
```

#### Update User Status (Admin only)
```http
PUT /api/v1/users/:userId/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "blocked"
}
```

#### Delete User (Admin only)
```http
DELETE /api/v1/users/:userId
Authorization: Bearer {token}
```

---

### Product Routes

#### Create Product (Seller only)
```http
POST /api/v1/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "price": 999.99,
  "quantity": 100
}
```

#### Get All Products
```http
GET /api/v1/products
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter

#### Get Product by ID
```http
GET /api/v1/products/:productId
```

#### Update Product (Seller only)
```http
PUT /api/v1/products/:productId
Authorization: Bearer {token}
Content-Type: application/json

{
  "price": 1099.99,
  "quantity": 150
}
```

#### Delete Product (Seller only)
```http
DELETE /api/v1/products/:productId
Authorization: Bearer {token}
```

#### Get Products by Seller
```http
GET /api/v1/products/seller/:sellerId
```

#### Get My Products (Seller only)
```http
GET /api/v1/products/my-products
Authorization: Bearer {token}
```

---

### Bid Routes

#### Create Bid (Buyer only)
```http
POST /api/v1/bids
Authorization: Bearer {token}
Content-Type: application/json

{
  "product_id": 1,
  "offered_price": 899.99,
  "end_time": "2025-12-31T23:59:59Z"
}
```

#### Get All Bids for a Product
```http
GET /api/v1/bids/product/:productId
```

#### Get Buyer's Bids
```http
GET /api/v1/bids/my-bids
Authorization: Bearer {token}
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, accepted, rejected)

#### Get Bids on Seller's Products
```http
GET /api/v1/bids/my-products
Authorization: Bearer {token}
```

#### Get Bid by ID
```http
GET /api/v1/bids/:bidId
Authorization: Bearer {token}
```

#### Update Bid Status (Seller only)
```http
PUT /api/v1/bids/:bidId/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "accepted"
}
```

#### Update Bid (Buyer only - only pending bids)
```http
PUT /api/v1/bids/:bidId
Authorization: Bearer {token}
Content-Type: application/json

{
  "offered_price": 950.00,
  "end_time": "2025-12-31T23:59:59Z"
}
```

#### Delete Bid (Buyer only - only pending bids)
```http
DELETE /api/v1/bids/:bidId
Authorization: Bearer {token}
```

#### Flag Suspicious Bid (Admin only)
```http
PUT /api/v1/bids/:bidId/flag
Authorization: Bearer {token}
Content-Type: application/json

{
  "is_suspicious": true,
  "flag_reason": "Unusual pricing pattern detected"
}
```

#### Get Suspicious Bids (Admin only)
```http
GET /api/v1/bids/suspicious
Authorization: Bearer {token}
```

---

### Warehouse Routes

#### Create Warehouse (Warehouse Owner only)
```http
POST /api/v1/warehouses
Authorization: Bearer {token}
Content-Type: application/json

{
  "location": "New York, NY",
  "capacity": 10000
}
```

#### Get All Warehouses
```http
GET /api/v1/warehouses
```

**Query Parameters:**
- `location` (optional): Filter by location
- `minCapacity` (optional): Minimum capacity filter

#### Get Warehouse by ID
```http
GET /api/v1/warehouses/:warehouseId
```

#### Get My Warehouses (Owner only)
```http
GET /api/v1/warehouses/my-warehouses
Authorization: Bearer {token}
```

#### Update Warehouse (Owner only)
```http
PUT /api/v1/warehouses/:warehouseId
Authorization: Bearer {token}
Content-Type: application/json

{
  "location": "Brooklyn, NY",
  "capacity": 15000
}
```

#### Delete Warehouse (Owner only)
```http
DELETE /api/v1/warehouses/:warehouseId
Authorization: Bearer {token}
```

#### Get Warehouse Inventory
```http
GET /api/v1/warehouses/:warehouseId/inventory
```

---

### Inventory Routes

#### Add Product to Warehouse
```http
POST /api/v1/inventory
Authorization: Bearer {token}
Content-Type: application/json

{
  "product_id": 1,
  "warehouse_id": 1,
  "quantity": 500,
  "stock_level": "high"
}
```

#### Update Inventory
```http
PUT /api/v1/inventory/:productId/:warehouseId
Authorization: Bearer {token}
Content-Type: application/json

{
  "quantity": 600,
  "stock_level": "medium"
}
```

#### Get Product Inventory
```http
GET /api/v1/inventory/product/:productId
```

#### Get Warehouse Inventory
```http
GET /api/v1/inventory/warehouse/:warehouseId
```

#### Delete Inventory Entry
```http
DELETE /api/v1/inventory/:productId/:warehouseId
Authorization: Bearer {token}
```

---

### Transaction Routes

#### Create Transaction
```http
POST /api/v1/transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "bid_id": 1,
  "buyer_id": 1,
  "seller_id": 1,
  "owner_id": 1,
  "type": "payment",
  "amount": 899.99
}
```

#### Get User Transactions
```http
GET /api/v1/transactions/my-transactions
Authorization: Bearer {token}
```

**Query Parameters:**
- `type` (optional): Filter by type (payment, refund, commission)
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

#### Get Transaction by ID
```http
GET /api/v1/transactions/:transactionId
Authorization: Bearer {token}
```

#### Get All Transactions (Admin only)
```http
GET /api/v1/transactions
Authorization: Bearer {token}
```

#### Get Transactions by Bid
```http
GET /api/v1/transactions/bid/:bidId
Authorization: Bearer {token}
```

---

### Notification Routes

#### Get User Notifications
```http
GET /api/v1/notifications
Authorization: Bearer {token}
```

**Query Parameters:**
- `is_read` (optional): Filter by read status (true/false)
- `type` (optional): Filter by notification type

#### Get Unread Count
```http
GET /api/v1/notifications/unread-count
Authorization: Bearer {token}
```

#### Mark Notification as Read
```http
PUT /api/v1/notifications/:notificationId/read
Authorization: Bearer {token}
```

#### Mark All Notifications as Read
```http
PUT /api/v1/notifications/read-all
Authorization: Bearer {token}
```

#### Delete Notification
```http
DELETE /api/v1/notifications/:notificationId
Authorization: Bearer {token}
```

---

### Rent Routes

#### Create Rental Agreement (Seller only)
```http
POST /api/v1/rents
Authorization: Bearer {token}
Content-Type: application/json

{
  "warehouse_id": 1,
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
```

#### Get Seller's Rentals
```http
GET /api/v1/rents/my-rentals
Authorization: Bearer {token}
```

#### Get Warehouse Rentals (Owner only)
```http
GET /api/v1/rents/warehouse/:warehouseId
Authorization: Bearer {token}
```

#### Get Active Rentals
```http
GET /api/v1/rents/active
Authorization: Bearer {token}
```

#### Update Rental
```http
PUT /api/v1/rents/:sellerId/:warehouseId/:startDate
Authorization: Bearer {token}
Content-Type: application/json

{
  "end_date": "2026-01-01"
}
```

#### Delete Rental
```http
DELETE /api/v1/rents/:sellerId/:warehouseId/:startDate
Authorization: Bearer {token}
```

---

## 🔒 Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Expiration
- **Access Token**: 7 days
- **Refresh Token**: 30 days

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Buyer** | Create bids, view products, manage own profile |
| **Seller** | Manage products, accept/reject bids, rent warehouses, view transactions |
| **Warehouse Owner** | Manage warehouses, manage inventory, view rentals |
| **Admin** | Full access to all routes, flag suspicious activities, manage users |

---

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

---

## 🐛 Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 500 | Internal Server Error |

---

## 🚢 Deployment

### Build for production
```bash
npm run build
```

### Start production server
```bash
npm start
```

### Using PM2
```bash
pm2 start dist/server.js --name bidstock-server
```

---

## 📊 Database Schema Overview

```
Users (Central Authentication)
├── Buyers
├── Sellers
└── Warehouse Owners

Products (Created by Sellers)
└── Inventory (Stored in Warehouses)

Bids (Created by Buyers on Products)
└── Transactions (Generated from Accepted Bids)

Warehouses (Owned by Warehouse Owners)
├── Inventory (Products stored)
└── Rents (Rented by Sellers)

Notifications (Sent to all Users)
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Authors

- Ishtiak  - Initial work

---

## 🙏 Acknowledgments

- Express.js community
- TypeScript team
- MySQL team

---

**BidStock** - Connecting Buyers, Sellers, and Warehouses in a Secure Marketplace