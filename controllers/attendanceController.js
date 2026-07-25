import asyncHandler from 'express-async-handler';
import Attendance from '../models/Attendance.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import EmployeeProfile from '../models/EmployeeProfile.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';

// Get start of day
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// @desc    Clock-in today
// @route   POST /api/attendance/checkin
// @access  Private (Employee)
export const checkIn = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  const startOfToday = getStartOfDay(now);

  // Check if already checked in today
  const existingAttendance = await Attendance.findOne({
    user: userId,
    date: startOfToday,
  });

  if (existingAttendance) {
    res.status(400);
    throw new Error('You have already clocked in today');
  }

  // Late entry threshold (e.g. 09:15 AM)
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isLate = (hour > 9) || (hour === 9 && minute > 15);

  const attendance = await Attendance.create({
    user: userId,
    date: startOfToday,
    checkIn: now,
    lateEntry: isLate,
    status: isLate ? 'Late' : 'Present',
    remarks: isLate ? 'Late check-in threshold exceeded (after 09:15)' : 'On-time punch',
  });

  sendSuccess(res, 'Clocked in successfully', attendance, 201);
});

// @desc    Clock-out today
// @route   POST /api/attendance/checkout
// @access  Private (Employee)
export const checkOut = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  const startOfToday = getStartOfDay(now);

  const attendance = await Attendance.findOne({
    user: userId,
    date: startOfToday,
  });

  if (!attendance) {
    res.status(404);
    throw new Error('No clock-in record found for today. Please clock in first.');
  }

  if (attendance.checkOut) {
    res.status(400);
    throw new Error('You have already clocked out today');
  }

  attendance.checkOut = now;
  
  // Calculate duration in hours
  const diffMs = now.getTime() - attendance.checkIn.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  attendance.workingHours = Math.round(hours * 100) / 100; // Keep two decimal places

  // Recalculate status based on hours
  if (attendance.workingHours < 4) {
    attendance.status = 'Half-Day';
    attendance.remarks = 'Worked less than 4 hours';
  } else if (attendance.lateEntry) {
    attendance.status = 'Late';
  } else {
    attendance.status = 'Present';
  }

  await attendance.save();
  sendSuccess(res, 'Clocked out successfully', attendance);
});

// @desc    Get current day's clock-in status
// @route   GET /api/attendance/status
// @access  Private
export const getTodayStatus = asyncHandler(async (req, res) => {
  const startOfToday = getStartOfDay(new Date());
  const attendance = await Attendance.findOne({
    user: req.user._id,
    date: startOfToday,
  });

  sendSuccess(res, 'Attendance status retrieved', {
    hasCheckedIn: !!attendance,
    hasCheckedOut: !!attendance?.checkOut,
    record: attendance,
  });
});

// @desc    Get user's attendance log (Employee page)
// @route   GET /api/attendance/history
// @access  Private
export const getMyAttendanceHistory = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const query = { user: req.user._id };

  if (month && year) {
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    query.date = { $gte: startDate, $lte: endDate };
  }

  const history = await Attendance.find(query).sort({ date: -1 });
  sendSuccess(res, 'Attendance history loaded', history);
});

// @desc    Get all employees attendance reports (Admin)
// @route   GET /api/admin/attendance
// @access  Private (Admin)
export const getEmployeesAttendanceAdmin = asyncHandler(async (req, res) => {
  const { date, month, year, search, department } = req.query;
  const query = {};

  if (date) {
    const filterDate = getStartOfDay(new Date(date));
    query.date = filterDate;
  } else if (month && year) {
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    query.date = { $gte: startDate, $lte: endDate };
  }

  // Construct search user filter
  const userFilter = { role: 'employee' };
  if (search) {
    userFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } }
    ];
  }
  if (department) {
    userFilter.department = department;
  }

  const matchedUsers = await User.find(userFilter).select('_id');
  const userIds = matchedUsers.map((u) => u._id);
  query.user = { $in: userIds };

  const list = await Attendance.find(query)
    .populate('user', 'name email employeeId department designation')
    .sort({ date: -1 });

  const attendanceUserIds = list.map((item) => item.user?._id).filter(Boolean);
  const profiles = await EmployeeProfile.find({ user: { $in: attendanceUserIds } }).select('user documents.profilePhoto');
  
  const photoMap = {};
  profiles.forEach((p) => {
    if (p.user && p.documents?.profilePhoto) {
      photoMap[p.user.toString()] = p.documents.profilePhoto;
    }
  });

  const listWithPhotos = list.map((item) => {
    const obj = item.toObject();
    if (obj.user) {
      obj.user.documents = {
        profilePhoto: photoMap[obj.user._id.toString()] || ''
      };
    }
    return obj;
  });

  sendSuccess(res, 'Attendance details retrieved successfully', listWithPhotos);
});

// @desc    Manually mark attendance (Admin)
// @route   POST /api/admin/attendance
// @access  Private (Admin)
export const markAttendanceManualAdmin = asyncHandler(async (req, res) => {
  const { userId, date, checkIn, checkOut, status, remarks } = req.body;

  if (!userId || !date || !status) {
    res.status(400);
    throw new Error('Please provide user ID, date, and status');
  }

  const startOfDate = getStartOfDay(new Date(date));

  // Check if attendance already exists for that user and date
  const existing = await Attendance.findOne({ user: userId, date: startOfDate });
  if (existing) {
    res.status(400);
    throw new Error('Attendance record already exists for this employee on this date');
  }

  let checkInTime = checkIn ? new Date(checkIn) : null;
  let checkOutTime = checkOut ? new Date(checkOut) : null;
  let workingHours = 0;

  if (checkInTime && checkOutTime) {
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  const attendance = await Attendance.create({
    user: userId,
    date: startOfDate,
    checkIn: checkInTime || startOfDate,
    checkOut: checkOutTime,
    workingHours,
    status,
    remarks: remarks || 'Manually marked by admin',
  });

  const userObj = await User.findById(userId);

  await AuditLog.create({
    user: req.user._id,
    action: 'MARK_ATTENDANCE_MANUAL',
    details: `Admin manually marked attendance as ${status} for ${userObj?.name || userId} on ${startOfDate.toLocaleDateString()}`,
  });

  sendSuccess(res, 'Attendance marked manually', attendance, 201);
});

// @desc    Delete attendance record (Admin)
// @route   DELETE /api/admin/attendance/:id
// @access  Private (Admin)
export const deleteAttendanceRecordAdmin = asyncHandler(async (req, res) => {
  const recordId = req.params.id;

  const attendance = await Attendance.findById(recordId).populate('user', 'name');
  if (!attendance) {
    res.status(404);
    throw new Error('Attendance record not found');
  }

  await Attendance.findByIdAndDelete(recordId);

  await AuditLog.create({
    user: req.user._id,
    action: 'DELETE_ATTENDANCE',
    details: `Admin deleted attendance record for ${attendance.user?.name} on ${new Date(attendance.date).toLocaleDateString()}`,
  });

  sendSuccess(res, 'Attendance record deleted successfully');
});

// @desc    Manual edit/update attendance record (Admin override)
// @route   PUT /api/admin/attendance/:id
// @access  Private (Admin)
export const editAttendanceRecordAdmin = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, status, remarks } = req.body;
  const recordId = req.params.id;

  const attendance = await Attendance.findById(recordId).populate('user', 'name');
  if (!attendance) {
    res.status(404);
    throw new Error('Attendance record not found');
  }

  if (checkIn) attendance.checkIn = new Date(checkIn);
  if (checkOut) {
    attendance.checkOut = new Date(checkOut);
    const diffMs = attendance.checkOut.getTime() - attendance.checkIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    attendance.workingHours = Math.round(hours * 100) / 100;
  }
  
  if (status) attendance.status = status;
  if (remarks) attendance.remarks = remarks;

  await attendance.save();

  // Audit trail
  await AuditLog.create({
    user: req.user._id,
    action: 'EDIT_ATTENDANCE',
    details: `Admin modified attendance for ${attendance.user.name} on ${new Date(attendance.date).toLocaleDateString()}`,
  });

  sendSuccess(res, 'Attendance record updated successfully', attendance);
});
