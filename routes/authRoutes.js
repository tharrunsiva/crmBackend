import express from 'express';
import { body } from 'express-validator';
import {
  registerEmployee,
  loginUser,
  logoutUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validatorMiddleware.js';

const router = express.Router();

// Validation Rules
const registerValidator = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Please input a valid email address').normalizeEmail(),
  body('employeeId').notEmpty().withMessage('Employee ID is required').trim(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

const loginValidator = [
  body('email').isEmail().withMessage('Please input a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  body('role').isIn(['admin', 'employee']).withMessage('Role must be admin or employee'),
];

const resetPasswordValidator = [
  body('email').isEmail().withMessage('Please input a valid email address'),
  body('otpCode').notEmpty().withMessage('OTP verification code is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
];

// Routes mapping
router.post('/register', registerValidator, validateRequest, registerEmployee);
router.post('/login', loginValidator, validateRequest, loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getCurrentUser);
router.post('/forgot-password', body('email').isEmail().withMessage('Please input a valid email'), validateRequest, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validateRequest, resetPassword);

export default router;
