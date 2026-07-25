import express from 'express';
import {
  getMyNotifications,
  markNotificationRead,
  markAllRead,
} from '../controllers/notificationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getMyNotifications);
router.put('/read-all', markAllRead);
router.put('/:id', markNotificationRead);

export default router;
