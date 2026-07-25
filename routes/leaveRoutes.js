import express from 'express';
import {
  applyLeave,
  getMyLeaves,
  getLeaveAnalytics,
} from '../controllers/leaveController.js';
import { protect, authorize, activeOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, authorize('employee'), activeOnly, applyLeave);
router.get('/my-leaves', protect, getMyLeaves);
router.get('/analytics', protect, getLeaveAnalytics);

export default router;
