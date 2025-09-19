import { logActivity, AuditActions, createLogDetails } from '../utils/auditLogger.js';

/**
 * Middleware to log application errors
 */
export const errorLogger = async (err, req, res, next) => {
  // Log the error details
  console.error('Application error:', err);
  
  // Log to audit log if we have a user ID
  if (req.userId) {
    try {
      await logActivity(
        req.userId,
        AuditActions.SYSTEM_ERROR,
        createLogDetails("System error occurred", {
          path: req.path,
          method: req.method,
          errorMessage: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        })
      );
    } catch (logError) {
      console.error('Error logging to audit log:', logError);
    }
  }
  
  next(err);
};

/**
 * Error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
