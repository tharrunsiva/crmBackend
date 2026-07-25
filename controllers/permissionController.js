import asyncHandler from 'express-async-handler';
import Permission from '../models/Permission.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';

// @desc    Request a short absence permission
// @route   POST /api/permissions
// @access  Private (Employee)
export const requestPermission = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, reason } = req.body;
  const userId = req.user._id;

  const permission = await Permission.create({
    user: userId,
    date: new Date(date),
    startTime,
    endTime,
    reason,
    status: 'Pending',
  });

  // Notify Admins
  const admins = await User.find({ role: 'admin' });
  const adminNotifications = admins.map((admin) => ({
    recipient: admin._id,
    sender: userId,
    title: 'New Permission Request',
    message: `${req.user.name} requested permission absence on ${new Date(date).toLocaleDateString()} from ${startTime} to ${endTime}`,
    type: 'permission',
  }));
  await Notification.insertMany(adminNotifications);

  // Audit log
  await AuditLog.create({
    user: userId,
    action: 'PERMISSION_REQUEST',
    details: `Absence request generated for ${date} (${startTime} - ${endTime})`,
  });

  sendSuccess(res, 'Permission request submitted successfully', permission, 201);
});

// @desc    Get logged in employee's permission requests
// @route   GET /api/permissions/my-permissions
// @access  Private
export const getMyPermissions = asyncHandler(async (req, res) => {
  const history = await Permission.find({ user: req.user._id }).sort({ createdAt: -1 });
  sendSuccess(res, 'Permissions history loaded', history);
});

// @desc    Get all permission requests (Admin)
// @route   GET /api/admin/permissions
// @access  Private (Admin)
export const getPermissionsAdmin = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const query = {};

  if (status) {
    query.status = status;
  }

  let userIds = [];
  if (search) {
    const matchedUsers = await User.find({
      name: { $regex: search, $options: 'i' },
      role: 'employee',
    }).select('_id');
    userIds = matchedUsers.map((u) => u._id);
    query.user = { $in: userIds };
  }

  const list = await Permission.find(query)
    .populate('user', 'name email employeeId department designation')
    .sort({ createdAt: -1 });

  sendSuccess(res, 'Permission list retrieved successfully', list);
});

// @desc    Approve or Reject permission request (Admin)
// @route   PUT /api/admin/permissions/:id/approve
// @access  Private (Admin)
export const approveRejectPermission = asyncHandler(async (req, res) => {
  const { status, adminComments } = req.body; // 'Approved' or 'Rejected'
  const permId = req.params.id;

  const permission = await Permission.findById(permId).populate('user', 'name email');
  if (!permission) {
    res.status(404);
    throw new Error('Permission request not found');
  }

  if (status !== 'Approved' && status !== 'Rejected') {
    res.status(400);
    throw new Error('Invalid status. Choose Approved or Rejected');
  }

  permission.status = status;
  permission.adminComments = adminComments || '';
  await permission.save();

  // Create Notification for the Employee
  await Notification.create({
    recipient: permission.user._id,
    sender: req.user._id,
    title: `Permission Request ${status}`,
    message: `Your permission request for absence on ${new Date(permission.date).toLocaleDateString()} has been ${status.toLowerCase()} by Admin.`,
    type: 'permission',
  });

  await AuditLog.create({
    user: req.user._id,
    action: status === 'Approved' ? 'PERMISSION_APPROVE' : 'PERMISSION_REJECT',
    details: `Admin ${status} permission request ${permission._id} for ${permission.user.name}`,
  });

  sendSuccess(res, `Permission request has been ${status}`, permission);
});
