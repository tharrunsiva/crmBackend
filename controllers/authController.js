import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import EmployeeProfile from '../models/EmployeeProfile.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';
import { sendWelcomeEmail, sendOTPEmail } from '../utils/emailService.js';

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc    Register a new employee
// @route   POST /api/auth/register
// @access  Public
export const registerEmployee = asyncHandler(async (req, res) => {
  const { name, email, employeeId, password } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  // Check if Employee ID is already registered
  const empIdExists = await User.findOne({ employeeId });
  if (empIdExists) {
    res.status(400);
    throw new Error('Employee ID is already registered');
  }

  // Create User in Pending state
  const user = await User.create({
    name,
    email,
    password,
    role: 'employee',
    employeeId,
    status: 'pending_onboarding',
    onboardingStep: 0,
  });

  if (user) {
    // Send email notification to user
    await sendWelcomeEmail(user);

    // Audit Log
    await AuditLog.create({
      user: user._id,
      action: 'REGISTER',
      details: `Employee signed up: ${user.name} (${user.employeeId})`,
    });

    sendSuccess(
      res,
      'Registration successful',
      {
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          employeeId: user.employeeId,
          onboardingStep: user.onboardingStep,
        },
      },
      201
    );
  } else {
    res.status(400);
    throw new Error('Invalid user data provided');
  }
});

// @desc    Login admin or employee
// @route   POST /api/auth/login
// @access  Public
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  // Find user by email and select password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  // Verify Role match
  if (user.role !== role) {
    res.status(403);
    throw new Error(`Unauthorized. You registered as an ${user.role}, not an ${role}`);
  }

  // Check Account Status
  if (user.status === 'rejected') {
    res.status(403);
    throw new Error('Your registration was rejected by the administrator.');
  }

  if (user.status === 'deactivated') {
    res.status(403);
    throw new Error('Your account is deactivated. Please contact the administrator.');
  }

  // Generate token
  const token = generateToken(user._id);

  // Set JWT in HTTP-Only Cookie
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };

  res.cookie('token', token, cookieOptions);

  // Audit log
  await AuditLog.create({
    user: user._id,
    action: 'LOGIN',
    details: `User logged in: ${user.name} (${user.role})`,
  });

  // Find profile photo if exists
  let profilePhoto = '';
  try {
    const profile = await EmployeeProfile.findOne({ user: user._id });
    if (profile && profile.documents && profile.documents.profilePhoto) {
      profilePhoto = profile.documents.profilePhoto;
    }
  } catch (err) {
    console.error('Error fetching employee profile photo:', err);
  }

  sendSuccess(res, 'Login successful', {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    hrId: user.hrId,
    status: user.status,
    onboardingStep: user.onboardingStep,
    profilePhoto,
    token,
  });
});

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = asyncHandler(async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  if (req.user) {
    await AuditLog.create({
      user: req.user._id,
      action: 'LOGOUT',
      details: `User logged out: ${req.user.name}`,
    });
  }

  sendSuccess(res, 'Logged out successfully');
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  let profilePhoto = '';
  try {
    const profile = await EmployeeProfile.findOne({ user: user._id });
    if (profile && profile.documents && profile.documents.profilePhoto) {
      profilePhoto = profile.documents.profilePhoto;
    }
  } catch (err) {
    console.error('Error fetching employee profile photo:', err);
  }

  const userObj = user.toObject();
  userObj.profilePhoto = profilePhoto;

  sendSuccess(res, 'User data retrieved', userObj);
});

// @desc    Trigger Forgot Password (send OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('No account found with this email');
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  user.otp = {
    code: otpCode,
    expiresAt,
  };
  await user.save();

  // Send OTP mail
  await sendOTPEmail(email, otpCode);

  sendSuccess(res, 'Verification OTP sent to your registered email');
});

// @desc    Verify OTP and Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otpCode, newPassword } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Verify OTP
  if (!user.otp || user.otp.code !== otpCode || new Date() > user.otp.expiresAt) {
    res.status(400);
    throw new Error('Invalid or expired OTP code');
  }

  // Update password and clear OTP
  user.password = newPassword;
  user.otp = undefined;
  await user.save();

  // Audit log
  await AuditLog.create({
    user: user._id,
    action: 'PASSWORD_RESET',
    details: `Password reset success for user: ${user.name}`,
  });

  sendSuccess(res, 'Password reset successful. You can now log in with your new password.');
});
