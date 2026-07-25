import asyncHandler from 'express-async-handler';
import Notification from '../models/Notification.js';
import { sendSuccess } from '../utils/responseFormatter.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getMyNotifications = asyncHandler(async (req, res) => {
  const list = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  sendSuccess(res, 'Notifications retrieved', list);
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id
// @access  Private
export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found or access denied');
  }
  sendSuccess(res, 'Notification marked as read', notification);
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  sendSuccess(res, 'All notifications marked as read');
});
