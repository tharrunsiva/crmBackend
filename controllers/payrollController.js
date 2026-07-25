import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs';
import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import EmployeeProfile from '../models/EmployeeProfile.js';
import AuditLog from '../models/AuditLog.js';
import { generatePayslipPDF } from '../utils/pdfGenerator.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';

// @desc    Generate payroll for an employee
// @route   POST /api/payroll/generate
// @access  Private (Admin)
export const generatePayroll = asyncHandler(async (req, res) => {
  const { userId, month, year, basicSalary, allowances, bonus, deductions } = req.body;

  // Validate employee exists
  const employee = await User.findById(userId);
  if (!employee || employee.role !== 'employee') {
    res.status(404);
    throw new Error('Employee account not found');
  }

  // Check if payroll already exists for the given period
  const existingPayroll = await Payroll.findOne({ user: userId, month, year });
  if (existingPayroll) {
    res.status(400);
    throw new Error(`Payroll already exists for this employee for ${month}/${year}`);
  }

  const base = parseFloat(basicSalary || 0);
  const allow = parseFloat(allowances || 0);
  const extra = parseFloat(bonus || 0);
  const deduct = parseFloat(deductions || 0);
  const net = base + allow + extra - deduct;

  // Create payroll record
  const payroll = new Payroll({
    user: userId,
    month,
    year,
    basicSalary: base,
    allowances: allow,
    bonus: extra,
    deductions: deduct,
    netSalary: net,
    status: 'Pending',
  });

  // Save to database to get details
  await payroll.save();

  // Generate PDF payslip
  const fileName = `payslip-${userId}-${month}-${year}.pdf`;
  const relativePath = `/uploads/payroll/${fileName}`;
  const absolutePath = path.resolve('uploads/payroll', fileName);

  try {
    await generatePayslipPDF(payroll, employee, absolutePath);
    payroll.payslipPath = relativePath;
    await payroll.save();
  } catch (pdfErr) {
    console.error('Failed to generate PDF payslip:', pdfErr);
    // Remove payroll record on generation error
    await Payroll.findByIdAndDelete(payroll._id);
    res.status(500);
    throw new Error('Error compiling PDF payslip, payroll generation aborted');
  }

  await AuditLog.create({
    user: req.user._id,
    action: 'GENERATE_PAYROLL',
    details: `Generated payroll for ${employee.name} for period ${month}/${year}. Net: Rs. ${net}`,
  });

  sendSuccess(res, 'Payroll record and payslip generated successfully', payroll, 201);
});

// @desc    Approve/Release payroll payment
// @route   PUT /api/payroll/:id/approve
// @access  Private (Admin)
export const approvePayroll = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'Approved' or 'Paid'
  const payrollId = req.params.id;

  const payroll = await Payroll.findById(payrollId).populate('user', 'name email');
  if (!payroll) {
    res.status(404);
    throw new Error('Payroll record not found');
  }

  if (status !== 'Approved' && status !== 'Paid') {
    res.status(400);
    throw new Error('Invalid status. Choose Approved or Paid');
  }

  payroll.status = status;
  if (status === 'Paid') {
    payroll.paymentDate = new Date();
  }
  await payroll.save();

  await AuditLog.create({
    user: req.user._id,
    action: 'APPROVE_PAYROLL',
    details: `Payroll status set to ${status} for ${payroll.user?.name || 'Deleted User'} (${payroll.month}/${payroll.year})`,
  });

  sendSuccess(res, `Payroll status set to ${status}`, payroll);
});

// @desc    Get logged in employee's payroll history
// @route   GET /api/payroll/history
// @access  Private
export const getMyPayrollHistory = asyncHandler(async (req, res) => {
  const history = await Payroll.find({ user: req.user._id }).sort({ year: -1, month: -1 });
  sendSuccess(res, 'Payroll details loaded successfully', history);
});

// @desc    Get all payroll listings (Admin)
// @route   GET /api/admin/payroll
// @access  Private (Admin)
export const getPayrollAdmin = asyncHandler(async (req, res) => {
  const { month, year, search } = req.query;
  const query = {};

  if (month) query.month = parseInt(month);
  if (year) query.year = parseInt(year);

  let userIds = [];
  if (search) {
    const matchedUsers = await User.find({
      name: { $regex: search, $options: 'i' },
      role: 'employee',
    }).select('_id');
    userIds = matchedUsers.map((u) => u._id);
    query.user = { $in: userIds };
  }

  const list = await Payroll.find(query)
    .populate('user', 'name email employeeId department designation')
    .sort({ year: -1, month: -1 });

  sendSuccess(res, 'All payrolls retrieved', list);
});

// @desc    Download PDF payslip
// @route   GET /api/payroll/:id/download
// @access  Private
export const downloadPayslip = asyncHandler(async (req, res) => {
  const payrollId = req.params.id;
  const payroll = await Payroll.findById(payrollId);

  if (!payroll) {
    res.status(404);
    throw new Error('Payroll record not found');
  }

  // Ensure security checks: Employees can only download their own payslips
  if (req.user.role === 'employee' && payroll.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Forbidden. You cannot download details for other employees');
  }

  // Ensure file path exists
  if (!payroll.payslipPath) {
    const fileName = `payslip-${payroll.user}-${payroll.month}-${payroll.year}.pdf`;
    payroll.payslipPath = `/uploads/payroll/${fileName}`;
    await payroll.save();
  }

  const absolutePath = path.resolve('.' + payroll.payslipPath);
  if (!fs.existsSync(absolutePath)) {
    // Regenerate physical file on the fly using updated currency formatting
    const employee = await User.findById(payroll.user);
    if (!employee) {
      res.status(404);
      throw new Error('Associated employee summary not found for PDF regeneration');
    }
    try {
      await generatePayslipPDF(payroll, employee, absolutePath);
    } catch (pdfErr) {
      console.error('Failed to regenerate PDF payslip:', pdfErr);
      res.status(500);
      throw new Error('Failed to regenerate payslip document on server');
    }
  }

  res.sendFile(absolutePath);
});
