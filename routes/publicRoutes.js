import express from "express";
import { prisma } from "../db/index.js";
import { AuditActions, createLogDetails, logActivity } from "../utils/auditLogger.js";

const router = express.Router();

// Get invite details (public route)
router.get("/invite/:token", async (req, res) => {
    try {
        const { token } = req.params;

        // Find the lender term by invite token
        const lenderTerm = await prisma.lenderTerm.findFirst({
            where: {
                inviteToken: token
            },
            include: {
                lender: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            }
        });

        if (!lenderTerm) {
            return res.status(404).json({ message: "Invalid invite link" });
        }

        res.json({
            lenderTerm,
            lender: lenderTerm.lender
        });
    } catch (error) {
        console.error('Error fetching invite details:', error);
        res.status(500).json({ message: "Failed to fetch invite details" });
    }
});

// Public signup with invite
router.post("/signup", async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password, inviteToken } = req.body;

        // Validate required fields
        if (!fullName || !email || !password || !inviteToken) {
            return res.status(400).json({ message: "Full name, email, password, and invite token are required" });
        }

        // Check if user with email already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: email.trim().toLowerCase()
            }
        });

        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // Find the lender term by invite token
        const lenderTerm = await prisma.lenderTerm.findFirst({
            where: {
                inviteToken: inviteToken
            }
        });

        if (!lenderTerm) {
            return res.status(400).json({ message: "Invalid invite token" });
        }

        // Hash the password
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user as BORROWER
        const user = await prisma.user.create({
            data: {
                fullName: fullName.trim(),
                email: email.trim().toLowerCase(),
                phoneNumber: phoneNumber ? phoneNumber.trim() : null,
                passwordHash: hashedPassword,
                role: "BORROWER",
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true
            }
        });

        // Create the relationship between lender and borrower
        await prisma.relationship.create({
            data: {
                lenderId: lenderTerm.lenderId,
                borrowerId: user.id,
                status: "CONFIRMED"
            }
        });

        // Log invite acceptance
        await logActivity(
            user.id,
            AuditActions.INVITE_ACCEPTED,
            createLogDetails("Borrower accepted lender invite", {
                // inviteToken: inviteToken,
                // lenderId: lenderTerm.lenderId,
                // borrowerId: user.id,
                borrowerEmail: user.email,
                borrowerPhone: user.phoneNumber
            })
        );

        res.status(201).json({
            message: "User registered successfully and connected to lender",
            user
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            message: "An error occurred during registration",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
