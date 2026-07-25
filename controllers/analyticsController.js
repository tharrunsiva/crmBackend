import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import EmployeeProfile from '../models/EmployeeProfile.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';
import Leave from '../models/Leave.js';
import Complaint from '../models/Complaint.js';
import { sendSuccess } from '../utils/responseFormatter.js';

// @desc    Get dashboard metrics and graphs data (Admin only)
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
export const getAdminDashboardAnalytics = asyncHandler(async (req, res) => {
  // 1. Cards Stats
  const totalEmployees = await User.countDocuments({ role: 'employee' });
  const activeEmployees = await User.countDocuments({ role: 'employee', status: 'active' });
  const pendingApprovals = await User.countDocuments({ role: 'employee', status: 'pending' });
  const openComplaints = await Complaint.countDocuments({ status: 'Open' });
  const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });

  // 2. Department distribution
  const departmentBreakdown = await User.aggregate([
    { $match: { role: 'employee' } },
    {
      $group: {
        _id: '$department',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        name: { $ifNull: ['$_id', 'Unassigned'] },
        value: '$count',
        _id: 0,
      },
    },
  ]);

  // 3. Gender breakdown
  const genderBreakdown = await EmployeeProfile.aggregate([
    {
      $group: {
        _id: '$gender',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        name: { $ifNull: ['$_id', 'Unspecified'] },
        value: '$count',
        _id: 0,
      },
    },
  ]);

  // 4. Leave distributions
  const leaveStats = await Leave.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        _id: 0,
      },
    },
  ]);

  // 5. Payroll Trend (Last 6 Months)
  const payrollTrend = await Payroll.aggregate([
    {
      $group: {
        _id: { month: '$month', year: '$year' },
        totalPayout: { $sum: '$netSalary' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 6 },
    {
      $project: {
        period: {
          $concat: [
            { $toString: '$_id.month' },
            '/',
            { $toString: '$_id.year' },
          ],
        },
        amount: '$totalPayout',
        _id: 0,
      },
    },
  ]);

  // 6. Attendance Rates (For today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendanceToday = await Attendance.aggregate([
    { $match: { date: today } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        status: '$_id',
        value: '$count',
        _id: 0,
      },
    },
  ]);

  sendSuccess(res, 'Analytics generated successfully', {
    cards: {
      totalEmployees,
      activeEmployees,
      pendingApprovals,
      openComplaints,
      pendingLeaves,
    },
    departments: departmentBreakdown,
    gender: genderBreakdown,
    leaves: leaveStats,
    payroll: payrollTrend,
    attendanceToday,
  });
});
