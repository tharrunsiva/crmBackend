import express from 'express';
import {
  submitOnboarding,
  getMyProfile,
  updateMyProfile,
} from '../controllers/employeeController.js';
import { getIDCardDetails } from '../controllers/idCardController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { onboardingUpload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Onboarding submission (Employee role only)
router.post('/onboarding', protect, authorize('employee'), onboardingUpload, submitOnboarding);

// Profile actions (Any logged in user can get/edit self profile)
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, updateMyProfile);

// Fetch ID Card details
router.get('/idcard/:employeeId', protect, getIDCardDetails);

export default router;
