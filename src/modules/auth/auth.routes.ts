import { Router } from "express";
import { authController } from "./auth.controller";
import auth from "../../middleware/auth";

const router = Router();

router.post("/signin", authController.signIn);
router.post("/signup", authController.signUp);
router.post("/refresh", authController.refreshToken);
router.post("/create-admin", auth("admin"), authController.createAdmin);

export const authRouter = router;