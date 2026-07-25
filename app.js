import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Import Middlewares
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';

// Import Routes
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================
// Root Route
// ==========================
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vinsup CRM Backend API is running 🚀',
    version: '1.0.0',
    health: '/health'
  });
});

// ==========================
// Health Check
// ==========================
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'Employee CRM API is running healthy'
  });
});

// ==========================
// API Routes
// ==========================
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// ==========================
// Error Handlers
// ==========================
app.use(notFound);
app.use(errorHandler);

export default app;