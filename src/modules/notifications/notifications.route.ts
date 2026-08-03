import { Router } from "express";
import { notificationsController } from "./notifications.controller";
import auth from "../../middleware/auth";

const router = Router();



// User-facing routes — require authentication
router.get("/my-notifications", auth(), notificationsController.getMyNotifications);
router.get("/unread-count", auth(), notificationsController.getUnreadCount);
router.patch("/:notification_id/read", auth(), notificationsController.markAsRead);
router.patch("/read-all", auth(), notificationsController.markAllAsRead);
router.delete("/:notification_id", auth(), notificationsController.deleteNotification);

export const notificationsRouter = router;