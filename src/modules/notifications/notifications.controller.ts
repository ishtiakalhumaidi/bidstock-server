import type { Request, Response } from "express";
import { notificationsService } from "./notifications.service";

const addNotification = async (req: Request, res: Response) => {
  try {
    const result = await notificationsService.addNotification(req.body);

    return res.status(201).json({
      success: true,
      message: "notification added successfully",
      data: { notification_id: result },
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getNotifications = async (req: Request, res: Response) => {
  try {
    const result = await notificationsService.getNotifications();

    return res.status(200).json({
      success: true,
      message: "notifications retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSingleNotification = async (req: Request, res: Response) => {
  try {
    const { notification_id } = req.params;

    const result = await notificationsService.getSingleNotification(
      notification_id as string
    );

    return res.status(200).json({
      success: true,
      message: "notification retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * user can see only their own notifications
 * later user_id will come from token
 */
const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;

    const result = await notificationsService.getMyNotifications(
      user_id as string
    );

    return res.status(200).json({
      success: true,
      message: "my notifications retrieved successfully",
      data: result[0],
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const markAsRead = async (req: Request, res: Response) => {
  try {
    const { notification_id } = req.params;

    await notificationsService.markAsRead(
      notification_id as string
    );

    return res.status(200).json({
      success: true,
      message: "notification marked as read",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { notification_id } = req.params;

    await notificationsService.deleteNotification(
      notification_id as string
    );

    return res.status(200).json({
      success: true,
      message: "notification deleted successfully",
    });
  } catch (error: any) {
    console.error("error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const notificationsController = {
  addNotification,
  getNotifications,
  getSingleNotification,
  getMyNotifications,
  markAsRead,
  deleteNotification,
};
