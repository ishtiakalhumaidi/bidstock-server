import { JwtPayload } from "jsonwebtoken";

export type UserRole = "buyer" | "seller" | "warehouse_owner" | "admin";

export interface CustomJwtPayload extends JwtPayload {
  user_id: number;

  email: string;
  name: string;
  role: UserRole;
  type: "access" | "refresh";
}

declare global {
  namespace Express {
    interface Request {
      user?: CustomJwtPayload;
    }
  }
}