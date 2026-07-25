import express from 'express';
import {
  submitComplaint,
  getMyComplaints,
  replyToComplaint,
  toggleComplaintStatus,
} from '../controllers/complaintController.js';
import { protect, authorize, activeOnly } from '../middlewares/authMiddleware.js';
import { complaintUpload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.post('/', protect, authorize('employee'), activeOnly, complaintUpload, submitComplaint);
router.get('/my-complaints', protect, getMyComplaints);
router.post('/:id/reply', protect, replyToComplaint);
router.put('/:id/status', protect, toggleComplaintStatus);

export default router;
