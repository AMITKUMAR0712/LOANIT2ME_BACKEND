import express from "express";
import { prisma } from "../db/index.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/payment-accounts - Get user's payment accounts
router.get("/", verifyToken, async (req, res) => {
    try {
        const paymentAccounts = await prisma.paymentAccount.findMany({
            where: { userId: req.userId },
            orderBy: { isDefault: 'desc' }
        });

        res.json({ paymentAccounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payment-accounts - Add new payment account
router.post("/", verifyToken, async (req, res) => {
    const { accountType, cashAppHandle, paypalEmail, accountNickname, isDefault = false } = req.body;

    try {
        // Validate account type specific fields
        if (accountType === 'CASHAPP') {
            if (!cashAppHandle || !cashAppHandle.startsWith('$')) {
                return res.status(400).json({ 
                    error: "CashApp handle must start with $ (e.g., $johndoe)" 
                });
            }
        }

        if (accountType === 'PAYPAL') {
            if (!paypalEmail || !paypalEmail.includes('@')) {
                return res.status(400).json({ 
                    error: "Please provide a valid PayPal email address" 
                });
            }
        }

        // If setting as default, remove default from other accounts
        if (isDefault) {
            await prisma.paymentAccount.updateMany({
                where: { 
                    userId: req.userId,
                    accountType: accountType
                },
                data: { isDefault: false }
            });
        }

        // Create new payment account
        const paymentAccount = await prisma.paymentAccount.create({
            data: {
                userId: req.userId,
                accountType,
                cashAppHandle: accountType === 'CASHAPP' ? cashAppHandle : null,
                paypalEmail: accountType === 'PAYPAL' ? paypalEmail : null,
                accountNickname,
                isDefault,
                isVerified: false // Will be verified later
            }
        });

        res.json({ paymentAccount });
    } catch (error) {
        if (error.code === 'P2002') {
            const field = accountType === 'CASHAPP' ? 'CashApp handle' : 'PayPal email';
            res.status(400).json({ error: `This ${field} is already linked to your account` });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// PUT /api/payment-accounts/:id - Update payment account
router.put("/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { accountNickname, isDefault } = req.body;

    try {
        // Verify ownership
        const account = await prisma.paymentAccount.findFirst({
            where: { id, userId: req.userId }
        });

        if (!account) {
            return res.status(404).json({ error: "Payment account not found" });
        }

        // If setting as default, remove default from other accounts
        if (isDefault) {
            await prisma.paymentAccount.updateMany({
                where: { 
                    userId: req.userId,
                    accountType: account.accountType,
                    id: { not: id }
                },
                data: { isDefault: false }
            });
        }

        const updatedAccount = await prisma.paymentAccount.update({
            where: { id },
            data: {
                accountNickname,
                isDefault
            }
        });

        res.json({ paymentAccount: updatedAccount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/payment-accounts/:id - Delete payment account
router.delete("/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        // Verify ownership
        const account = await prisma.paymentAccount.findFirst({
            where: { id, userId: req.userId }
        });

        if (!account) {
            return res.status(404).json({ error: "Payment account not found" });
        }

        await prisma.paymentAccount.delete({
            where: { id }
        });

        res.json({ message: "Payment account deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
