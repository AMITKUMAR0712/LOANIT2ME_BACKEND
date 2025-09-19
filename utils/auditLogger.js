import { prisma } from '../db/index.js';

/**
 * Creates an audit log entry
 * @param {string} userId - ID of the user who performed the action
 * @param {string} action - Description of the action (e.g., 'USER_LOGIN', 'LOAN_APPROVED')
 * @param {string|object} details - Additional details about the action (will be stringified if object)
 * @returns {Promise<Object>} - The created audit log
 */
export const logActivity = async (userId, action, details = null) => {
  try {
    // Convert details object to string if it's an object
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;

    const auditLog = await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: detailsStr,
      },
      include: {
        user: true,
      },
    });

    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // We don't want to throw errors from logging functions as they are usually auxiliary
    // but we should still log the error for debugging
    return null;
  }
};

/**
 * Audit log action types - constants for consistent logging
 */
export const AuditActions = {
  // User related actions
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTER: 'USER_REGISTER',
  USER_UPDATE: 'USER_UPDATE',
  USER_PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
  
  // Loan related actions
  LOAN_CREATED: 'LOAN_CREATED',
  LOAN_APPROVED: 'LOAN_APPROVED',
  LOAN_DENIED: 'LOAN_DENIED',
  LOAN_FUNDED: 'LOAN_FUNDED',
  LOAN_COMPLETED: 'LOAN_COMPLETED',
  LOAN_STATUS_CHANGE: 'LOAN_STATUS_CHANGE',
  
  // Payment related actions
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_DISPUTED: 'PAYMENT_DISPUTED',
  PAYMENT_PROOF_SUBMITTED: 'PAYMENT_PROOF_SUBMITTED',
  
  // Relationship related actions
  RELATIONSHIP_CREATED: 'RELATIONSHIP_CREATED',
  RELATIONSHIP_UPDATED: 'RELATIONSHIP_UPDATED',
  
  // Lender term related actions
  TERM_CREATED: 'TERM_CREATED',
  TERM_UPDATED: 'TERM_UPDATED',
  TERM_PAYMENT_PREFERENCES_UPDATED: 'TERM_PAYMENT_PREFERENCES_UPDATED',
  
  // Invite related actions
  INVITE_SENT: 'INVITE_SENT',
  INVITE_ACCEPTED: 'INVITE_ACCEPTED',
  
  // Admin actions
  ADMIN_USER_MANAGEMENT: 'ADMIN_USER_MANAGEMENT',
  ADMIN_LOAN_MANAGEMENT: 'ADMIN_LOAN_MANAGEMENT',
  ADMIN_PAYMENT_MANAGEMENT: 'ADMIN_PAYMENT_MANAGEMENT',
  
  // System actions
  SYSTEM_ERROR: 'SYSTEM_ERROR',
};

/**
 * Creates a formatted details object for consistent audit logging
 * @param {string} message - A human-readable message
 * @param {object} data - Additional data to include
 * @returns {object} - Formatted details object
 */
export const createLogDetails = (message, data = {}) => {
  return {
    message,
    timestamp: new Date().toISOString(),
    data,
  };
};
