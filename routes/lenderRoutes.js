import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { prisma } from "../db/index.js";
import { logActivity, AuditActions, createLogDetails } from "../utils/auditLogger.js";

const router = express.Router();

// Get all lender terms for a user
router.get("/terms", verifyToken, async (req, res) => {
    try {
        const lenderTerms = await prisma.lenderTerm.findMany({
            where: {
                lenderId: req.userId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json({ lenderTerms });
    } catch (error) {
        console.error('Error fetching lender terms:', error);
        res.status(500).json({ message: "Failed to fetch lender terms" });
    }
});

// Create a new lender term
router.post("/terms", verifyToken, async (req, res) => {
    try {
        const { maxLoanAmount, loanMultiple, maxPaybackDays, feePer10Short, feePer10Long, allowMultipleLoans } = req.body;

        // Validate required fields
        if (!maxLoanAmount || !maxPaybackDays || !feePer10Short || !feePer10Long) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Generate invite token (simple implementation)
        const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // If the creator is currently a BORROWER, upgrade them to BOTH so they can act as a lender
        const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, role: true } })
        if (currentUser && currentUser.role === "BORROWER") {
            await prisma.user.update({ where: { id: req.userId }, data: { role: "BOTH" } })
        }

        const lenderTerm = await prisma.lenderTerm.create({
            data: {
                lenderId: req.userId,
                maxLoanAmount: parseFloat(maxLoanAmount),
                loanMultiple: parseFloat(loanMultiple) || 10,
                maxPaybackDays: parseInt(maxPaybackDays),
                feePer10Short: parseFloat(feePer10Short),
                feePer10Long: parseFloat(feePer10Long),
                allowMultipleLoans: allowMultipleLoans || false,
                inviteToken
            }
        });

        // Log lender term creation
        await logActivity(
            req.userId,
            AuditActions.TERM_CREATED,
            createLogDetails("Lender term created", {
                // termId: lenderTerm.id,
                maxLoanAmount: parseFloat(maxLoanAmount),
                maxPaybackDays: parseInt(maxPaybackDays),
                inviteToken: inviteToken
            })
        );

        res.status(201).json({
            message: "Lender term created successfully",
            lenderTerm
        });
    } catch (error) {
        console.error('Error creating lender term:', error);
        res.status(500).json({ message: "Failed to create lender term" });
    }
});

// Update an existing lender term
router.patch("/terms/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { maxLoanAmount, loanMultiple, maxPaybackDays, feePer10Short, feePer10Long, allowMultipleLoans } = req.body;

        // Validate required fields
        if (!maxLoanAmount || !maxPaybackDays || !feePer10Short || !feePer10Long) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Verify ownership of the term
        const existingTerm = await prisma.lenderTerm.findFirst({
            where: {
                id,
                lenderId: req.userId
            }
        });

        if (!existingTerm) {
            return res.status(404).json({ message: "Lender term not found or not authorized" });
        }

        const updatedTerm = await prisma.lenderTerm.update({
            where: { id },
            data: {
                maxLoanAmount: parseFloat(maxLoanAmount),
                loanMultiple: parseFloat(loanMultiple) || 10,
                maxPaybackDays: parseInt(maxPaybackDays),
                feePer10Short: parseFloat(feePer10Short),
                feePer10Long: parseFloat(feePer10Long),
                allowMultipleLoans: allowMultipleLoans || false
            }
        });

        // Log lender term update
        await logActivity(
            req.userId,
            AuditActions.TERM_UPDATED,
            createLogDetails("Lender term updated", {
                // termId: id,
                maxLoanAmount: parseFloat(maxLoanAmount) != existingTerm.maxLoanAmount ? parseFloat(maxLoanAmount) : undefined,
                maxPaybackDays: parseInt(maxPaybackDays) != existingTerm.maxPaybackDays ? parseInt(maxPaybackDays) : undefined,
                loanMultiple: parseFloat(loanMultiple) != existingTerm.loanMultiple ? parseFloat(loanMultiple) : undefined,
                feePer10Short: parseFloat(feePer10Short) != existingTerm.feePer10Short ? parseFloat(feePer10Short) : undefined,
                feePer10Long: parseFloat(feePer10Long) != existingTerm.feePer10Long ? parseFloat(feePer10Long) : undefined,
                allowMultipleLoans: (allowMultipleLoans !== undefined && allowMultipleLoans !== existingTerm.allowMultipleLoans) ? allowMultipleLoans : undefined,
                // previousValues: {
                //     maxLoanAmount: existingTerm.maxLoanAmount,
                //     loanMultiple: existingTerm.loanMultiple,
                //     maxPaybackDays: existingTerm.maxPaybackDays,
                //     feePer10Short: existingTerm.feePer10Short,
                //     feePer10Long: existingTerm.feePer10Long,
                //     allowMultipleLoans: existingTerm.allowMultipleLoans
                // },
                // newValues: {
                //     maxLoanAmount: parseFloat(maxLoanAmount),
                //     loanMultiple: parseFloat(loanMultiple) || 10,
                //     maxPaybackDays: parseInt(maxPaybackDays),
                //     feePer10Short: parseFloat(feePer10Short),
                //     feePer10Long: parseFloat(feePer10Long),
                //     allowMultipleLoans: allowMultipleLoans || false
                // }
            })
        );

        res.json({
            message: "Lender term updated successfully",
            lenderTerm: updatedTerm
        });
    } catch (error) {
        console.error('Error updating lender term:', error);
        res.status(500).json({ message: "Failed to update lender term" });
    }
});

router.put("/terms/payment-preference/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params
        const { preferredPaymentMethods, requireMatchingPaymentMethod } = req.body;

        // console.log(preferredPaymentMethods, requireMatchingPaymentMethod );
        

        // Validate required fields
        if (!preferredPaymentMethods || !requireMatchingPaymentMethod) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Verify ownership of the term
        const existingTerm = await prisma.lenderTerm.findFirst({
            where: {
                id,
                lenderId: req.userId
            }
        });

        if (!existingTerm) {
            return res.status(404).json({ message: "Lender term not found or not authorized" });
        }

        const updatedTerm = await prisma.lenderTerm.update({
            where: {
                id,
                lenderId: req.userId
            },
            data: {
                preferredPaymentMethods,
                requireMatchingPaymentMethod
            },
            include: { lender: true }
        });

        res.json({ success: true, message: 'Lender term preference method updated successfully', lenderTerm: updatedTerm });


    } catch (error) {
        console.error('Error updating preference method lender term:', error);
        res.status(500).json({ success: false, message: 'Failed to update lender term preference method' });
    }
});

// Get all loans for a lender
router.get("/loans", verifyToken, async (req, res) => {
    try {
        const loans = await prisma.loan.findMany({
            where: {
                lenderId: req.userId
            },
            include: {
                borrower: {
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
        console.error('Error fetching lender loans:', error);
        res.status(500).json({ message: "Failed to fetch loans" });
    }
});

// Fund a loan (change status from PENDING to FUNDED)
router.post("/loans/:id/fund", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the loan and verify ownership
        const loan = await prisma.loan.findFirst({
            where: {
                id,
                lenderId: req.userId
            },
            include: {
                lenderTerm: true
            }
        });

        if (!loan) {
            return res.status(404).json({ message: "Loan not found" });
        }

        if (loan.status !== "PENDING") {
            return res.status(400).json({ message: "Loan is not pending" });
        }

        // // Calculate payback date based on lender terms
        // const paybackDate = new Date();
        // paybackDate.setDate(paybackDate.getDate() + (loan.lenderTerm?.maxPaybackDays || 14));

        // Update loan status
        const updatedLoan = await prisma.loan.update({
            where: { id },
            data: {
                status: "FUNDED",
                // dateBorrowed: new Date(),
                // paybackDate,
                lenderTermId: loan.lenderTerm?.id || null
            },
            include: {
                borrower: true,
                lenderTerm: true
            }
        });

        // Log loan funding
        await logActivity(
            req.userId,
            AuditActions.LOAN_FUNDED,
            createLogDetails("Loan funded by lender", {
                // loanId: id,
                // borrowerId: updatedLoan.borrower.id,
                borrowerEmail: updatedLoan.borrower.email,
                borrowerName: updatedLoan.borrower.fullName,
                amount: updatedLoan.amount,
                // paybackDate: updatedLoan.paybackDate
            })
        );

        res.json({
            message: "Loan funded successfully",
            loan: updatedLoan
        });
    } catch (error) {
        console.error('Error funding loan:', error);
        res.status(500).json({ message: "Failed to fund loan" });
    }
});

router.post("/loans/:id/deny", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const loan = await prisma.loan.findFirst({
            where: {
                id,
                lenderId: req.userId
            },
            include: {
                lenderTerm: true
            }
        })
        if (!loan) {
            return res.status(404).json({ message: "Loan not found" });
        }
        if (loan.status !== "PENDING") {
            return res.status(400).json({ message: "Loan is not pending" });
        }
        const updatedLoan = await prisma.loan.update({
            where: { id },
            data: {
                status: "DENIED"
            },
            include: {
                borrower: true,
                lenderTerm: true
            }
        })
        // Log loan denial
        await logActivity(
            req.userId,
            AuditActions.LOAN_DENIED,
            createLogDetails("Loan denied by lender", {
                // loanId: id,
                // borrowerId: updatedLoan.borrower.id,
                borrowerEmail: updatedLoan.borrower.email,
                borrowerName: updatedLoan.borrower.fullName,
                amount: updatedLoan.amount
            })
        );

        res.json({
            message: "Loan DENIED successfully",
            loan: updatedLoan
        })
    } catch (error) {
        console.error('Error denying loan:', error);
        res.status(500).json({ message: "Failed to deny loan" });
    }
})

// router.post("/loans/:id/overdue",verifyToken,async (req, res) => {
//     try {
//         const { id } = req.params;
//         const loan = await prisma.loan.findFirst({
//             where: {
//                 id,
//                 lenderId: req.userId
//             },
//             include: {
//                 lenderTerm: true
//             }
//         })
//         if (!loan) {
//             return res.status(404).json({ message: "Loan not found" });
//         }
//         const updatedLoan = await prisma.loan.update({
//             where: { id },
//             data: {
//                 status: "OVERDUE"
//             },
//             include: {
//                 borrower: true,
//                 lenderTerm: true
//             }
//         })
//         // Log loan marked as overdue
//         await logActivity(
//             req.userId,
//             AuditActions.LOAN_STATUS_CHANGE,
//             createLogDetails("Loan marked as overdue by lender", {
//                 // loanId: id,
//                 // borrowerId: updatedLoan.borrower.id,
//                 borrowerEmail: updatedLoan.borrower.email,
//                 borrowerName: updatedLoan.borrower.fullName,
//                 amount: updatedLoan.amount,
//                 previousStatus: loan.status,
//                 newStatus: "OVERDUE"
//             })
//         );

//         res.json({ 
//             message: "Loan OVERDUE successfully",
//             loan: updatedLoan 
//         })
//     } catch (error) {
//         console.error('Error marking loan as overdue:', error);
//         res.status(500).json({ message: "Failed to mark loan as overdue" });
//     }
// })


// Get all relationships for a lender
router.get("/relationships", verifyToken, async (req, res) => {
    try {
        const relationships = await prisma.relationship.findMany({
            where: {
                lenderId: req.userId
            },
            include: {
                borrower: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true,
                        role: true
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

// Update relationship status
router.patch("/relationships/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['CONFIRMED', 'BLOCKED'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const relationship = await prisma.relationship.findFirst({
            where: {
                id,
                lenderId: req.userId
            }
        });

        if (!relationship) {
            return res.status(404).json({ message: "Relationship not found" });
        }

        const updatedRelationship = await prisma.relationship.update({
            where: { id },
            data: { status },
            include: {
                borrower: true
            }
        });

        // Log relationship status change
        await logActivity(
            req.userId,
            AuditActions.RELATIONSHIP_UPDATED,
            createLogDetails("Relationship status updated by lender", {
                // relationshipId: id,
                // borrowerId: updatedRelationship.borrower.id,
                borrowerEmail: updatedRelationship.borrower.email,
                // borrowerName: updatedRelationship.borrower.fullName,
                previousStatus: relationship.status,
                newStatus: status
            })
        );

        res.json({
            message: "Relationship updated successfully",
            relationship: updatedRelationship
        });
    } catch (error) {
        console.error('Error updating relationship:', error);
        res.status(500).json({ message: "Failed to update relationship" });
    }
});

export default router;
