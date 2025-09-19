import { prisma } from '../../db/index.js';

export const getAuditLogs = async (req, res) => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ auditLogs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};