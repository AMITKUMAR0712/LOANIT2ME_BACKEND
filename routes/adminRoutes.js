import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import {
  getUsers,
  updateUser,
  deleteUser,
} from '../controllers/Admin/user.controller.js';
import { getLoans, updateLoan } from '../controllers/Admin/loan.controller.js';
import { getRelationships, updateRelationship } from '../controllers/Admin/relationship.controller.js';
import { getLenderTerms, updateLenderTerm } from '../controllers/Admin/lenderTerm.controller.js';
import { getPayments, confirmPayment } from '../controllers/Admin/payment.controller.js';
import { getAuditLogs } from '../controllers/Admin/auditLog.controller.js';
import { getNotifications, markNotificationRead } from '../controllers/Admin/notification.controller.js';

const router = express.Router();

// Apply authentication and admin verification to all routes
router.use(verifyToken, verifyAdmin);

// User routes
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Loan routes
router.get('/loans', getLoans);
router.patch('/loans/:id', updateLoan);

// Relationship routes
router.get('/relationships', getRelationships);
router.patch('/relationships/:id', updateRelationship);

// Lender Term routes
router.get('/lender-terms', getLenderTerms);
router.patch('/lender-terms/:id', updateLenderTerm);

// Payment routes
router.get('/payments', getPayments);
router.patch('/payments/:id/confirm', confirmPayment);

// Audit Log routes
router.get('/audit-logs', getAuditLogs);

// Notification routes
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;