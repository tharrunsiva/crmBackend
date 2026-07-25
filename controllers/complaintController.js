import asyncHandler from 'express-async-handler';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';

// @desc    Submit a complaint
// @route   POST /api/complaints
// @access  Private (Employee)
export const submitComplaint = asyncHandler(async (req, res) => {
  const { title, description, priority, department } = req.body;
  const userId = req.user._id;

  let attachmentPath = '';
  if (req.file) {
    attachmentPath = `/uploads/documents/${req.file.filename}`;
  }

  const complaint = await Complaint.create({
    user: userId,
    title,
    description,
    priority: priority || 'Medium',
    department,
    attachment: attachmentPath,
    status: 'Open',
  });

  // Notify Admin
  const admins = await User.find({ role: 'admin' });
  const adminNotifications = admins.map((admin) => ({
    recipient: admin._id,
    sender: userId,
    title: 'New Complaint Filed',
    message: `${req.user.name} submitted a new ${priority || 'Medium'} priority complaint: "${title}"`,
    type: 'complaint',
  }));
  await Notification.insertMany(adminNotifications);

  await AuditLog.create({
    user: userId,
    action: 'COMPLAINT_SUBMIT',
    details: `Filed complaint titled: "${title}"`,
  });

  sendSuccess(res, 'Complaint submitted successfully', complaint, 201);
});

// @desc    Get employee's complaints
// @route   GET /api/complaints/my-complaints
// @access  Private
export const getMyComplaints = asyncHandler(async (req, res) => {
  const list = await Complaint.find({ user: req.user._id })
    .populate('replies.sender', 'name role')
    .sort({ createdAt: -1 });
  sendSuccess(res, 'Complaints loaded successfully', list);
});

// @desc    Get all complaints (Admin)
// @route   GET /api/admin/complaints
// @access  Private (Admin)
export const getComplaintsAdmin = asyncHandler(async (req, res) => {
  const { status, priority, search } = req.query;
  const query = {};

  if (status) query.status = status;
  if (priority) query.priority = priority;

  let userIds = [];
  if (search) {
    const matchedUsers = await User.find({
      name: { $regex: search, $options: 'i' },
      role: 'employee',
    }).select('_id');
    userIds = matchedUsers.map((u) => u._id);
    query.user = { $in: userIds };
  }

  const list = await Complaint.find(query)
    .populate('user', 'name email employeeId department designation')
    .populate('replies.sender', 'name role')
    .sort({ createdAt: -1 });

  sendSuccess(res, 'Complaints fetched successfully', list);
});

// @desc    Add reply message in ticket thread
// @route   POST /api/complaints/:id/reply
// @access  Private (Employee or Admin)
export const replyToComplaint = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const complaintId = req.params.id;
  const senderId = req.user._id;

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    res.status(404);
    throw new Error('Complaint ticket not found');
  }

  // Security check: Employee can only reply to their own complaints
  if (req.user.role === 'employee' && complaint.user.toString() !== senderId.toString()) {
    res.status(403);
    throw new Error('Forbidden. You cannot reply to other employees complaints');
  }

  // Push message
  complaint.replies.push({
    sender: senderId,
    message,
    createdAt: new Date(),
  });

  // Automatically mark as in-progress if admin replies and status is open
  if (req.user.role === 'admin' && complaint.status === 'Open') {
    complaint.status = 'In-Progress';
  }

  await complaint.save();

  // Create notifications
  let notifyRecipient = complaint.user; // If admin replies, notify employee
  if (req.user.role === 'employee') {
    // If employee replies, notify admins
    const admins = await User.find({ role: 'admin' });
    const adminNotifications = admins.map((admin) => ({
      recipient: admin._id,
      sender: senderId,
      title: 'New Reply on Complaint',
      message: `${req.user.name} added a reply on ticket: "${complaint.title}"`,
      type: 'complaint',
    }));
    await Notification.insertMany(adminNotifications);
  } else {
    // Notify employee
    await Notification.create({
      recipient: notifyRecipient,
      sender: senderId,
      title: 'Admin Replied to Complaint',
      message: `HR Administration posted a response on your ticket: "${complaint.title}"`,
      type: 'complaint',
    });
  }

  sendSuccess(res, 'Reply posted successfully', complaint);
});

// @desc    Resolve or close complaint
// @route   PUT /api/complaints/:id/status
// @access  Private (Admin or Employee)
export const toggleComplaintStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // status: 'Resolved' or 'Closed'
  const complaintId = req.params.id;

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    res.status(404);
    throw new Error('Complaint not found');
  }

  // Employee can only close their own ticket, Admin can resolve or close
  if (req.user.role === 'employee' && complaint.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Forbidden');
  }

  if (req.user.role === 'employee' && status !== 'Closed') {
    res.status(400);
    throw new Error('Employees can only Close their complaints');
  }

  complaint.status = status;
  await complaint.save();

  // Audit log
  await AuditLog.create({
    user: req.user._id,
    action: `COMPLAINT_${status.toUpperCase()}`,
    details: `Ticket status set to ${status} for ID ${complaint._id}`,
  });

  // Notify counterpart
  if (req.user.role === 'admin') {
    await Notification.create({
      recipient: complaint.user,
      sender: req.user._id,
      title: `Complaint Ticket ${status}`,
      message: `Your complaint ticket "${complaint.title}" has been set to ${status} by Admin.`,
      type: 'complaint',
    });
  }

  sendSuccess(res, `Complaint status updated to ${status}`, complaint);
});
