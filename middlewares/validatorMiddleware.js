import { validationResult } from 'express-validator';
import { sendError } from '../utils/responseFormatter.js';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsgs = errors.array().map((err) => `${err.path || err.param}: ${err.msg}`);
    return sendError(res, 'Validation failed', 400, errorMsgs);
  }
  next();
};
