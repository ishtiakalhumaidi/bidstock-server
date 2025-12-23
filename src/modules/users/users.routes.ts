import { Router } from "express";
import { userController } from "./users.controller";
import auth from "../../middleware/auth";

const router = Router();

router.get("/dashboard-stats", auth(), userController.getDashboardStats);
router.get("/", auth("admin"), userController.getUsers);
router.get("/:user_id", auth(), userController.getSingleUser);
router.put("/:user_id", auth(), userController.updateUser);
router.delete("/:user_id", auth("admin"), userController.deleteUser);

export const userRouter = router;
