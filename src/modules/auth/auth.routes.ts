import { Router } from "express";
import { authController } from "./auth.controller";
const router = Router();

router.post("/signin", authController.signinUser);
router.post("/signup", authController.signUpUser);

export const authRouter = router;
