import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { prisma } from "../db/index.js";

const router = express.Router();

// Get all notifications for the current user
router.get("/", verifyToken, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: {
                userId: req.userId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                loan: {
                    select: {
                        id: true,
                        amount: true,
                        status: true,
                        borrower: {
                            select: {
                                fullName: true
                            }
                        },
                        lender: {
                            select: {
                                fullName: true
                            }
                        }
                    }
                }
            }
        });

        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

// Create a notification
router.post("/", verifyToken, async (req, res) => {
    try {
        const { loanId, type, message, userId } = req.body;

        const notification = await prisma.notification.create({
            data: {
                userId: userId,
                loanId: loanId,
                type: type,
                message: message,
                isRead: false
            }
        });

        res.status(201).json({ 
            message: "Notification created successfully",
            notification 
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ message: "Failed to create notification" });
    }
});

// Mark notification as read
router.patch("/:id/read", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId: req.userId
            }
        });

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        const updatedNotification = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        res.json({ 
            message: "Notification marked as read",
            notification: updatedNotification 
        });
    } catch (error) {
        console.error('Error updating notification:', error);
        res.status(500).json({ message: "Failed to update notification" });
    }
});

export default router;