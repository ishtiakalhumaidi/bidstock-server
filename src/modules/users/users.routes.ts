import { Router } from "express";
import { userController } from "./users.controller";

const router = Router();

router.post("/", userController.createUser);
router.get("/", userController.getUsers);
router.get("/:user_id", userController.getSingleUser);
router.put("/:user_id", userController.updateUser);
router.delete("/:user_id", userController.deleteUser);

export const userRouter = router;
