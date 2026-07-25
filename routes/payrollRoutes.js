import express from 'express';
import {
  generatePayroll,
  approvePayroll,
  getMyPayrollHistory,
  downloadPayslip,
} from '../controllers/payrollController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Admin operations
router.post('/generate', protect, authorize('admin'), generatePayroll);
router.put('/:id/approve', protect, authorize('admin'), approvePayroll);

// Employee & Admin operations
router.get('/history', protect, getMyPayrollHistory);
router.get('/:id/download', protect, downloadPayslip);

export default router;
