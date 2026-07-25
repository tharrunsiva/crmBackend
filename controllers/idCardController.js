import asyncHandler from 'express-async-handler';
import IDCard from '../models/IDCard.js';
import User from '../models/User.js';
import EmployeeProfile from '../models/EmployeeProfile.js';
import AuditLog from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';

// @desc    Get ID Card data (Both Admin and Employee verification)
// @route   GET /api/idcard/:employeeId
// @access  Private
export const getIDCardDetails = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  // Security check: Employees can only view their own card details
  if (req.user.role === 'employee' && req.user.employeeId !== employeeId) {
    res.status(403);
    throw new Error('Forbidden. You can only view your own ID Card.');
  }

  const user = await User.findOne({ employeeId, role: 'employee' });
  if (!user) {
    res.status(404);
    throw new Error('Employee not found');
  }

  const profile = await EmployeeProfile.findOne({ user: user._id });
  
  // Find or auto-generate IDCard database record
  let card = await IDCard.findOne({ user: user._id });
  if (!card) {
    const validityDate = new Date();
    validityDate.setFullYear(validityDate.getFullYear() + 5); // 5 years validity

    card = await IDCard.create({
      user: user._id,
      cardId: `CRD-${user.employeeId.split('-').pop()}-${Date.now().toString().slice(-4)}`,
      validUntil: validityDate,
      status: 'Active',
    });
  }

  // Construct response details
  const payload = {
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    department: user.department,
    designation: user.designation,
    joinDate: user.joinDate,
    dob: profile?.dob || null,
    bloodGroup: profile?.bloodGroup || 'N/A',
    phone: user.phone || 'N/A',
    emergencyPhone: profile?.emergencyContact?.phone || 'N/A',
    profilePhoto: profile?.documents?.profilePhoto || '',
    cardId: card.cardId,
    issuedAt: card.issuedAt,
    validUntil: card.validUntil,
    status: card.status,
  };

  sendSuccess(res, 'ID Card data retrieved', payload);
});

// @desc    Trigger/Regenerate ID Card record (Admin)
// @route   POST /api/idcard/generate
// @access  Private (Admin)
export const generateIDCardAdmin = asyncHandler(async (req, res) => {
  const { userId, validYears = 5 } = req.body;

  const user = await User.findById(userId);
  if (!user || user.role !== 'employee') {
    res.status(404);
    throw new Error('Employee account not found');
  }

  // Generate validity date
  const validityDate = new Date();
  validityDate.setFullYear(validityDate.getFullYear() + parseInt(validYears));

  // Find existing card or create new
  let card = await IDCard.findOne({ user: userId });
  if (card) {
    card.validUntil = validityDate;
    card.status = 'Active';
    await card.save();
  } else {
    card = await IDCard.create({
      user: userId,
      cardId: `CRD-${user.employeeId.split('-').pop()}-${Date.now().toString().slice(-4)}`,
      validUntil: validityDate,
      status: 'Active',
    });
  }

  await AuditLog.create({
    user: req.user._id,
    action: 'GENERATE_ID_CARD',
    details: `Admin generated/renewed ID Card ID ${card.cardId} for ${user.name}`,
  });

  sendSuccess(res, 'ID Card generated successfully', card, 201);
});
