import type { Request, Response } from "express";
import { notificationsService } from "./notifications.service";

const addNotification = async (req: Request, res: Response) => {
  try {
    const result = await notificationsService.addNotification(req.body);
    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: { notification_id: result },
    });
  } catch (error: any) {
    console.error("Add notification error:", error.message);
    if (error.message.includes("required") || error.message.includes("Invalid")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to create notification" });
  }
};

const getMyNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await notificationsService.getMyNotifications(req.user.user_id as number);

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get notifications error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve notifications" });
  }
};

const getUnreadCount = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const count = await notificationsService.getUnreadCount(req.user.user_id as number);

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error("Get unread count error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve unread count" });
  }
};

const markAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { notification_id } = req.params;
    await notificationsService.markAsRead(notification_id as string, req.user.user_id as number);

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    console.error("Mark as read error:", error.message);
    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

const markAllAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await notificationsService.markAllAsRead(req.user.user_id as number);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    console.error("Mark all as read error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};

const deleteNotification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { notification_id } = req.params;
    await notificationsService.deleteNotification(notification_id as string, req.user.user_id as number);

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete notification error:", error.message);
    if (error.message.includes("Forbidden")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

export const notificationsController = {
  addNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};