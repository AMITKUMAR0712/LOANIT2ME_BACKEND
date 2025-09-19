import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

import authRoutes from "./routes/authRoutes.js";
import lenderRoutes from "./routes/lenderRoutes.js";
import borrowerRoutes from "./routes/borrowerRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import inviteRoutes from "./routes/inviteRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import paymentAccountRoutes from "./routes/paymentAccountRoutes.js";
import manualPaymentRoutes from "./routes/manualPaymentRoutes.js";
import { errorLogger, errorHandler } from "./middleware/errorLogger.js";

import cookieParser from "cookie-parser";

import { nodemailerJob } from "./scheduler/nodemailerJob.js"

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// If you send form-urlencoded data
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/lender", lenderRoutes);
app.use("/api/borrower", borrowerRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/invite", inviteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use('/api/admin', adminRoutes); // Dynamic import for admin routes
app.use('/api/test', testRoutes); // Routes for testing functionality
app.use('/api/payment', paymentRoutes); // Routes for payment functionality
app.use('/api/payment-accounts', paymentAccountRoutes); // Routes for payment account management
app.use('/api/payments', manualPaymentRoutes); // Routes for manual payment management

// Error handling middlewares
app.use(errorLogger);
app.use(errorHandler);

nodemailerJob.start(); // Start the cron job

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});