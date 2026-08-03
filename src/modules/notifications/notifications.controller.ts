// notifications.controller.ts
import type { Request, Response } from "express";
import { notificationsService } from "./notifications.service";
import { AppError } from "../../utils/AppError";

const handleError = (res: Response, error: any, fallbackMessage: string) => {
  console.error(fallbackMessage, error.message);
  if (error instanceof AppError) {
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const getMyNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { page, limit, type, is_read } = req.query;
    const result = await notificationsService.getMyNotifications(
      req.user.user_id as number,
      {
        page: page as string,
        limit: limit as string,
        type: type as "bid_update" | "transaction" | "inventory_alert" | "system",
        is_read: is_read as string,
      }
    );
    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to retrieve notifications");
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
    return handleError(res, error, "Failed to retrieve unread count");
  }
};

const markAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { notification_id } = req.params;
    await notificationsService.markAsRead(
      notification_id as string,
      req.user.user_id as number
    );
    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to update notification");
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
    return handleError(res, error, "Failed to update notifications");
  }
};

const deleteNotification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { notification_id } = req.params;
    await notificationsService.deleteNotification(
      notification_id as string,
      req.user.user_id as number
    );
    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error: any) {
    return handleError(res, error, "Failed to delete notification");
  }
};

export const notificationsController = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};