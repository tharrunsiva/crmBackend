import express from 'express';
import {
  requestPermission,
  getMyPermissions,
} from '../controllers/permissionController.js';
import { protect, authorize, activeOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, authorize('employee'), activeOnly, requestPermission);
router.get('/my-permissions', protect, getMyPermissions);

export default router;
