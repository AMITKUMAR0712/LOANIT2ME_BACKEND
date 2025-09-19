import { prisma } from '../../db/index.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      include: { user: true, loan: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
      include: { user: true, loan: true },
    });
    res.json({ message: 'Notification marked as read', notification: updatedNotification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};