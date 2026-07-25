import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

// Protect routes
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Read token from Authorization header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Check if token exists
  if (!token) {
    res.status(401);
    throw new Error('Not authorized to access this route, token missing');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      res.status(401);
      throw new Error('No user associated with this token');
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    res.status(401);
    throw new Error('Not authorized to access this route, token invalid');
  }
});

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`User role (${req.user?.role}) is not authorized to access this route`);
    }
    next();
  };
};

// Enforce active status (approved by admin)
export const activeOnly = (req, res, next) => {
  if (!req.user || req.user.status !== 'active') {
    res.status(403);
    throw new Error('Your account status is not active. Please complete onboarding and await approval.');
  }
  next();
};
