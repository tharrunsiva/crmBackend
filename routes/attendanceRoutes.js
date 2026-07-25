import express from 'express';
import {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyAttendanceHistory,
} from '../controllers/attendanceController.js';
import { protect, authorize, activeOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/checkin', protect, authorize('employee'), activeOnly, checkIn);
router.post('/checkout', protect, authorize('employee'), activeOnly, checkOut);
router.get('/status', protect, getTodayStatus);
router.get('/history', protect, getMyAttendanceHistory);

export default router;
