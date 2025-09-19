import { prisma } from '../db/index.js';
import { logActivity, AuditActions, createLogDetails } from '../utils/auditLogger.js';

export const testAuditLog = async (req, res) => {
  try {
    // Create a test audit log entry
    const auditLog = await logActivity(
      req.userId,
      AuditActions.SYSTEM_ERROR,
      createLogDetails("Test audit log entry", {
        testData: "This is a test audit log entry",
        timestamp: new Date().toISOString()
      })
    );
    
    // Find all audit logs for the current user
    const userLogs = await prisma.auditLog.findMany({
      where: {
        userId: req.userId
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    res.json({
      message: "Audit log test completed successfully",
      testLog: auditLog,
      recentLogs: userLogs
    });
  } catch (error) {
    console.error('Error testing audit log:', error);
    res.status(500).json({ 
      message: 'Failed to test audit log',
      error: error.message
    });
  }
};
