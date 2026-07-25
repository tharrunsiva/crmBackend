import { sendError } from '../utils/responseFormatter.js';

// 404 Route Not Found handler
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Central Error Handler
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const message = err.message || 'Internal Server Error';
  
  console.error(`[Error Middleware] Code: ${statusCode} | Msg: ${message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  // Handle Mongoose cast errors or validator errors specifically if needed
  let finalMessage = message;
  let validationErrors = null;

  if (err.name === 'ValidationError') {
    res.status(400);
    finalMessage = 'Validation failed';
    validationErrors = Object.values(err.errors).map((val) => val.message);
  } else if (err.name === 'CastError') {
    res.status(400);
    finalMessage = `Resource not found with id of ${err.value}`;
  }

  const finalStatus = res.statusCode === 200 ? 500 : res.statusCode;

  return res.status(finalStatus).json({
    success: false,
    message: finalMessage,
    errors: validationErrors,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
