import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { testAuditLog } from '../controllers/testAuditLog.js';

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// Test route for audit logging
router.get('/test-audit-log', testAuditLog);

export default router;
