import express, { type Request, type Response } from "express";
import { initialDB } from "./config/db";
import { userRouter } from "./modules/users/users.routes";
import { productRouter } from "./modules/products/products.routers";
import { warehouseRouter } from "./modules/warehouses/warehouse.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routers";
import { bidsRouter } from "./modules/bid/bids.route";

export const app = express();
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to BidStock server...");
});

initialDB();

// user CRUD
app.use("/api/v1/users", userRouter);

// product CRUD
app.use("/api/v1/products", productRouter);

// warehouse CRUD
app.use("/api/v1/warehouses", warehouseRouter);

// inventory CRUD
app.use("/api/v1/inventories", inventoryRouter);

// bid CRUD
app.use("/api/v1/bids", bidsRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "route not found",
    path: req.path,
  });
});
