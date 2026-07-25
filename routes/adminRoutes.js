import express from 'express';
import {
  getEmployeesList,
  getEmployeeById,
  approveRejectEmployee,
  toggleEmployeeStatus,
  resetEmployeePasswordAdmin,
  bulkActionEmployees,
} from '../controllers/employeeController.js';
import {
  getEmployeesAttendanceAdmin,
  editAttendanceRecordAdmin,
  markAttendanceManualAdmin,
  deleteAttendanceRecordAdmin,
} from '../controllers/attendanceController.js';
import { getPayrollAdmin } from '../controllers/payrollController.js';
import { getLeavesAdmin, approveRejectLeave } from '../controllers/leaveController.js';
import { getPermissionsAdmin, approveRejectPermission } from '../controllers/permissionController.js';
import { getComplaintsAdmin } from '../controllers/complaintController.js';
import { getIDCardDetails, generateIDCardAdmin } from '../controllers/idCardController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Enforce admin check for all subroutes
router.use(protect);
router.use(authorize('admin'));

// Employees CRUD & Approvals
router.get('/employees', getEmployeesList);
router.get('/employees/:id', getEmployeeById);
router.put('/employees/:id/approve', approveRejectEmployee);
router.put('/employees/:id/status', toggleEmployeeStatus);
router.put('/employees/:id/reset-password', resetEmployeePasswordAdmin);
router.post('/employees/bulk', bulkActionEmployees);

// Attendance review
router.get('/attendance', getEmployeesAttendanceAdmin);
router.post('/attendance', markAttendanceManualAdmin);
router.put('/attendance/:id', editAttendanceRecordAdmin);
router.delete('/attendance/:id', deleteAttendanceRecordAdmin);

// Payroll lists
router.get('/payroll', getPayrollAdmin);

// Leaves management
router.get('/leaves', getLeavesAdmin);
router.put('/leaves/:id/approve', approveRejectLeave);

// Permissions management
router.get('/permissions', getPermissionsAdmin);
router.put('/permissions/:id/approve', approveRejectPermission);

// Complaints overview
router.get('/complaints', getComplaintsAdmin);

// ID Card management
router.get('/idcard/:employeeId', getIDCardDetails);
router.post('/idcard/generate', generateIDCardAdmin);

export default router;
