import express, { type Request, type Response } from "express";
import cors from "cors";
import { initialDB, runMigrations } from "./config/db";
import { userRouter } from "./modules/users/users.routes";
import { productRouter } from "./modules/products/products.routers";
import { warehouseRouter } from "./modules/warehouses/warehouse.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routers";
import { bidsRouter } from "./modules/bid/bids.route";
import { transactionsRouter } from "./modules/transactions/transactions.router";
import { notificationsRouter } from "./modules/notifications/notifications.route";
import { rentRouter } from "./modules/rents/rent.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { offersRouter } from "./modules/offers/offers.routes";

export const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to BidStock server...");
});

// user CRUD
app.use("/api/v1/users", userRouter);

// product CRUD
app.use("/api/v1/products", productRouter);

// warehouse CRUD
app.use("/api/v1/warehouses", warehouseRouter);

// inventory CRUD
app.use("/api/v1/inventory", inventoryRouter);

// bid CRUD
app.use("/api/v1/bids", bidsRouter);

// offers CRUD
app.use("/api/v1/offers", offersRouter);

// transactions CRUD
app.use("/api/v1/transactions", transactionsRouter);

// notifications CRUD
app.use("/api/v1/notifications", notificationsRouter);

// rents CRUD
app.use("/api/v1/rents", rentRouter);

// auth
app.use("/api/v1/auth", authRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "route not found",
    path: req.path,
  });
});


export const bootstrapDatabase = async () => {
  try {
    await initialDB();
    await runMigrations();
    console.log("[db] Database ready.");
  } catch (error: any) {
    console.error("[db] Failed to initialize database:", error.message);

    process.exit(1);
  }
};