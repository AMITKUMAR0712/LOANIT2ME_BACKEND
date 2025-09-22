import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { prisma } from "../db/index.js";
import { logActivity, AuditActions, createLogDetails } from "../utils/auditLogger.js";

const router = express.Router();

// Get all loans for a borrower
router.get("/loans", verifyToken, async (req, res) => {
    try {
        const loans = await prisma.loan.findMany({
            where: {
                borrowerId: req.userId
            },
            include: {
                lender: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true,
                        role: true
                    }
                },
                lenderTerm: true,
                payments: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json({ loans });
    } catch (error) {
        console.error('Error fetching borrower loans:', error);
        res.status(500).json({ message: "Failed to fetch loans" });
    }
});

// Get all relationships for a borrower (connected lenders)
router.get("/relationships", verifyToken, async (req, res) => {
    try {
        const relationships = await prisma.relationship.findMany({
            where: {
                borrowerId: req.userId,
                status: "CONFIRMED"
            },
            include: {
                lender: {
                    include: {
                        lenderTerms: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json({ relationships });
    } catch (error) {
        console.error('Error fetching relationships:', error);
        res.status(500).json({ message: "Failed to fetch relationships" });
    }
});

// Request a new loan
router.post("/loans", verifyToken, async (req, res) => {
    try {
        const { lenderId, amount, paybackDays, signedBy, agreementText, lenderTermId, agreedPaymentAccountId, agreedPaymentMethod } = req.body;

        // Validate required fields
        if (!lenderId || !amount || !paybackDays) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if borrower has a confirmed relationship with the lender
        const relationship = await prisma.relationship.findFirst({
            where: {
                lenderId,
                borrowerId: req.userId,
                status: "CONFIRMED"
            }
        });

        if (!relationship) {
            return res.status(400).json({ message: "No confirmed relationship with this lender" });
        }

        // Get lender terms to calculate fees
        let lenderTerm = null;
        if (lenderTermId) {
            lenderTerm = await prisma.lenderTerm.findFirst({
                where: {
                    id: lenderTermId,
                    lenderId
                }
            });
        }

        // Calculate fees based on lender terms or default values
        let feeAmount = 0;
        if (lenderTerm) {
            const feePer10 = paybackDays <= 7 ? lenderTerm.feePer10Short : lenderTerm.feePer10Long;
            feeAmount = (amount / 10) * feePer10;
        } else {
            // Default fee calculation
            const feePer10 = paybackDays <= 7 ? 1.0 : 2.0;
            feeAmount = (amount / 10) * feePer10;
        }

        const totalPayable = amount + feeAmount;

        // Calculate payback date
        const paybackDate = new Date();
        paybackDate.setDate(paybackDate.getDate() + paybackDays);

        const loan = await prisma.loan.create({
            data: {
                lenderId,
                borrowerId: req.userId,
                lenderTermId: lenderTerm?.id || null,
                amount: parseFloat(amount),
                dateBorrowed: new Date(),
                paybackDate,
                feeAmount,
                totalPayable,
                status: "PENDING",
                health: "GOOD",
                // agreementText: agreementText,
                agreementText: signedBy,    //rn signedBy but it has agreement text
                signedBy: signedBy,
                signedDate: new Date(),
                agreedPaymentAccountId,
                agreedPaymentMethod
            },
            include: {
                lender: true,
                lenderTerm: true
            }
        });

        // console.log(loan);
        

        // Log loan request creation
        await logActivity(
            req.userId,
            AuditActions.LOAN_CREATED,
            createLogDetails("Loan request created by borrower", {
                // loanId: loan.id,
                // lenderId: lenderId,
                amount: parseFloat(amount),
                paybackDays: paybackDays,
                totalPayable: totalPayable
            })
        );

        res.status(201).json({
            message: "Loan request created successfully",
            loan
        });
    } catch (error) {
        console.error('Error creating loan request:', error);
        res.status(500).json({ message: "Failed to create loan request" });
    }
});

// Record a payment for a loan
router.post("/loans/:id/payments", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, method, reference } = req.body;

        // Validate required fields
        if (!amount || !method) {
            return res.status(400).json({ message: "Amount and payment method are required" });
        }

        // Find the loan and verify ownership
        const loan = await prisma.loan.findFirst({
            where: {
                id,
                borrowerId: req.userId
            }
        });

        if (!loan) {
            return res.status(404).json({ message: "Loan not found" });
        }

        if (loan.status === "COMPLETED") {
            return res.status(400).json({ message: "Loan is already completed" });
        }

        // Create payment record
        const payment = await prisma.payment.create({
            data: {
                loanId: id,
                amount: parseFloat(amount),
                paymentDate: new Date(),
                method,
                confirmed: false,
                reference: reference || null
            }
        });

        // Log payment creation
        await logActivity(
            req.userId,
            AuditActions.PAYMENT_CREATED,
            createLogDetails("Payment recorded by borrower", {
                // paymentId: payment.id,
                // loanId: id,
                amount: parseFloat(amount),
                method: method,
                reference: reference || null
            })
        );

        res.status(201).json({
            message: "Payment recorded successfully",
            payment
        });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ message: "Failed to record payment" });
    }
});


// Mark a loan as completed
router.patch("/loans/:id/completed", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the loan and verify ownership
        const loan = await prisma.loan.findFirst({
            where: {
                id,
                borrowerId: req.userId
            }
        });

        if (!loan) {
            return res.status(404).json({ message: "Loan not found" });
        }

        if (loan.status === "COMPLETED") {
            return res.status(400).json({ message: "Loan is already completed" });
        }

        // Mark the loan as completed
        const updatedLoan = await prisma.loan.update({
            where: {
                id,
                borrowerId: req.userId
            },
            data: { status: "COMPLETED" }
        });

        // Log loan completion
        await logActivity(
            req.userId,
            AuditActions.LOAN_COMPLETED,
            createLogDetails("Loan marked as completed by borrower", {
                // loanId: id,
                // lenderId: loan.lenderId,
                amount: loan.amount,
                totalPayable: loan.totalPayable
            })
        );

        res.status(200).json({ message: "Loan marked as completed" });
    } catch (error) {
        console.error('Error marking loan as completed:', error);
        res.status(500).json({ message: "Failed to mark loan as completed" });
    }
});

router.post("/loans/multiple", verifyToken, async (req, res) => {
    try {
        // console.log(req.body);

        const borrowerId = req.userId;
        const { lenderId, lenderTermId } = req.body;

        const term = await prisma.lenderTerm.findUnique({
            where: { id: lenderTermId }
        })

        if (!term) {
            return res.status(400).json({ message: "Invalid lender term ID" });
        }

        if (term.allowMultipleLoans === true) {
            return res.json({ message: "No active loans. You can request a new loan." });
        }

        const activeLoans = await prisma.loan.findFirst({
            where: {
                lenderId,
                borrowerId,
                lenderTermId,
            }
        });

        if (activeLoans) {
            return res.status(400).json({ message: "You have existing active loans. Cannot request a new loan." });
        }

        res.json({ message: "No active loans. You can request a new loan." });
    } catch (error) {
        console.error('Error checking multiple loans:', error);
        res.status(500).json({ message: "Failed to check loans" });
    }

});


router.post("/payment/payment-method", verifyToken, async (req, res) => {
    try {
        const borrowerId = req.userId;
        const { paymentMethod } = req.body;

        // console.log("Borrower:", borrowerId, "Method:", paymentMethod);

        const payment = await prisma.paymentAccount.findFirst({
            where: {
                userId: borrowerId,
                accountType: paymentMethod,
            },
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Kindly add that payment method",
            });
        }

        return res.json({
            success: true,
            data: payment,
        });
    } catch (error) {
        console.error("Error fetching payment method:", error);
        return res.status(500).json({
            success: false,
            message: "Server error, please try again later",
        });
    }
});




export default router;
