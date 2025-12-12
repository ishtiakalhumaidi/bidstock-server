import express, { type Request, type Response } from "express";
import { initialDB } from "./config/db";
import { userRouter } from "./modules/users/users.routes";

export const app = express();
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to BidStock server...");
});

// user CRUD
app.use("/api/v1/users", userRouter);
initialDB();

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "route not found",
    path: req.path,
  });
});
