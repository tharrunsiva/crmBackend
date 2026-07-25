import express from 'express';
import { getAdminDashboardAnalytics } from '../controllers/analyticsController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getAdminDashboardAnalytics);

export default router;
