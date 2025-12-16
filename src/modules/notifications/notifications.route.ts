import { Router } from "express";
import { notificationsController } from "./notifications.controller";

const router = Router();

router.get("/", notificationsController.getNotifications);
router.get(
  "/me/:user_id",
  notificationsController.getMyNotifications
);
router.get(
  "/:notification_id",
  notificationsController.getSingleNotification
);
router.post("/", notificationsController.addNotification);
router.patch(
  "/:notification_id/read",
  notificationsController.markAsRead
);
router.delete(
  "/:notification_id",
  notificationsController.deleteNotification
);

export const notificationsRouter = router;
