import asyncHandler from 'express-async-handler';
import Leave from '../models/Leave.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private (Employee)
export const applyLeave = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, halfDayType, reason } = req.body;
  const userId = req.user._id;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    res.status(400);
    throw new Error('Start date must be before or equal to end date');
  }

  const leave = await Leave.create({
    user: userId,
    leaveType,
    startDate: start,
    endDate: end,
    halfDayType: halfDayType || 'None',
    reason,
    status: 'Pending',
  });

  // Notify Admins
  const admins = await User.find({ role: 'admin' });
  const adminNotifications = admins.map((admin) => ({
    recipient: admin._id,
    sender: userId,
    title: 'New Leave Request Filed',
    message: `${req.user.name} applied for ${leaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
    type: 'leave',
  }));
  await Notification.insertMany(adminNotifications);

  await AuditLog.create({
    user: userId,
    action: 'LEAVE_APPLY',
    details: `Applied for ${leaveType} leave from ${startDate} to ${endDate}`,
  });

  sendSuccess(res, 'Leave application submitted successfully', leave, 201);
});

// @desc    Get logged in employee's leaves
// @route   GET /api/leaves/my-leaves
// @access  Private
export const getMyLeaves = asyncHandler(async (req, res) => {
  const list = await Leave.find({ user: req.user._id }).sort({ createdAt: -1 });
  sendSuccess(res, 'Leaves history loaded', list);
});

// @desc    Get all employees leaves (Admin)
// @route   GET /api/admin/leaves
// @access  Private (Admin)
export const getLeavesAdmin = asyncHandler(async (req, res) => {
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

  const list = await Leave.find(query)
    .populate('user', 'name email employeeId department designation')
    .sort({ createdAt: -1 });

  // Filter out any leave requests from employee accounts that have been deleted
  const activeLeaves = list.filter((leave) => leave.user !== null);

  sendSuccess(res, 'Employee leaves retrieved successfully', activeLeaves);
});

// @desc    Approve or Reject leave request (Admin)
// @route   PUT /api/admin/leaves/:id/approve
// @access  Private (Admin)
export const approveRejectLeave = asyncHandler(async (req, res) => {
  const { status, adminComments } = req.body; // status: 'Approved' or 'Rejected'
  const leaveId = req.params.id;

  const leave = await Leave.findById(leaveId).populate('user', 'name email');
  if (!leave) {
    res.status(404);
    throw new Error('Leave application not found');
  }

  if (status !== 'Approved' && status !== 'Rejected') {
    res.status(400);
    throw new Error('Invalid status. Choose Approved or Rejected');
  }

  leave.status = status;
  leave.adminComments = adminComments || '';
  await leave.save();

  // Create Notification for the Employee
  await Notification.create({
    recipient: leave.user._id,
    sender: req.user._id,
    title: `Leave Application ${status}`,
    message: `Your application for ${leave.leaveType} leave has been ${status.toLowerCase()} by Admin. Comments: ${adminComments || 'None'}`,
    type: 'leave',
  });

  await AuditLog.create({
    user: req.user._id,
    action: status === 'Approved' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT',
    details: `Admin ${status} leave ID ${leave._id} for ${leave.user.name}`,
  });

  sendSuccess(res, `Leave request has been ${status}`, leave);
});

// @desc    Get leave metrics & balances
// @route   GET /api/leaves/analytics
// @access  Private
export const getLeaveAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Limits
  const totalAllocated = 30; // 30 leaves per year allocation
  
  // Aggregate leaves
  const approvedLeaves = await Leave.find({
    user: userId,
    status: 'Approved',
  });

  let leavesTakenCount = 0;
  approvedLeaves.forEach((leave) => {
    const diffTime = Math.abs(leave.endDate - leave.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    leavesTakenCount += leave.halfDayType !== 'None' ? 0.5 : diffDays;
  });

  const remaining = Math.max(0, totalAllocated - leavesTakenCount);

  // Split counts by category
  const categories = ['Annual', 'Medical', 'Emergency', 'Permission', 'Half-Day', 'Custom'];
  const distribution = {};
  for (const cat of categories) {
    distribution[cat] = await Leave.countDocuments({ user: userId, leaveType: cat, status: 'Approved' });
  }

  sendSuccess(res, 'Leave metrics retrieved', {
    allocated: totalAllocated,
    taken: leavesTakenCount,
    remaining,
    distribution,
  });
});
