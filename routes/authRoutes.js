import express from "express";
import { verifyToken } from "../middleware/auth.js";
import bcrypt from "bcrypt";
import { prisma } from "../db/index.js";
import jwt from "jsonwebtoken";
import { logActivity, AuditActions, createLogDetails } from "../utils/auditLogger.js";

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        // console.log(req.body);
        const { fullName, email, phoneNumber, password } = req.body;
        // console.log(fullName, email, phoneNumber, password);

        // Validate required fields
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "Full name, email, and password are required" });
        }

        // Check if user with email already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: email.trim().toLowerCase()
            }
        });
        // console.log(existingUser);

        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user
        const user = await prisma.user.create({
            data: {
                fullName: fullName.trim(),
                email: email.trim().toLowerCase(),
                phoneNumber: phoneNumber ? phoneNumber.trim() : null,
                passwordHash: hashedPassword,
                role: "LENDER",
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true
            }
        });
        // console.log(user);


        // Log user registration
        await logActivity(
            user.id, 
            AuditActions.USER_REGISTER, 
            createLogDetails("New user registered", { email: user.email, role: user.role })
        );

        res.status(201).json({
            message: "User registered successfully",
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

router.post("/login", async (req, res) => {

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid password" });
    }
    // console.log(user);
    const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET);

    // Log user login
    await logActivity(
        user.id,
        AuditActions.USER_LOGIN,
        createLogDetails("User logged in", { email: user.email })
    );

    // res.cookie("token", token);
    res.json({
        message: "Login successful",
        token,
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role
        }
    });
});

router.get("/me", verifyToken, async (req, res) => {

    const user = await prisma.user.findUnique({
        where: { id: req.userId }, select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true
        }
    });
    // console.log(user);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json({
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role
    });

    // res.json({ message: "Me", userId: req.userId, role: req.userRole, email: req.userEmail, fullName: req.userFullName, phoneNumber: req.userPhoneNumber });
});

router.post("/logout", verifyToken, async (req, res) => {
    // The client is responsible for removing the token from localStorage
    // We could implement token blacklisting here if needed
    
    // Log user logout
    await logActivity(
        req.userId,
        AuditActions.USER_LOGOUT,
        createLogDetails("User logged out")
    );
    
    res.json({ message: "Logged out successfully" });
});

export default router;