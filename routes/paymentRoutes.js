import express from "express";
import { callCashAppAPI, confirmStripePayment, simulateCashAppTransfer } from "../services/cashAppService.js";
import { sendPayPalPayout, createPayPalPayment, executePayPalPayment, checkPayoutStatus } from "../services/paypalService.js";
import { prisma } from "../db/index.js";

const router = express.Router();

router.post("/", async (req, res) => {
    const { loanId, amount, method, payerRole, receiverRole } = req.body;

    try {
        // Get loan details to find payer and receiver
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                lender: true,
                borrower: true,
                payments: true
            }
        });

        // console.log(loan);


        if (!loan) {
            return res.status(404).json({ error: "Loan not found" });
        }

        let fromUserId, toUserId;
        if (payerRole === "LENDER") {
            fromUserId = loan.lenderId;
            toUserId = loan.borrowerId;
        } else {
            fromUserId = loan.borrowerId;
            toUserId = loan.lenderId;
        }

        // Get payment accounts for both users based on method
        let fromCashApp = null, toCashApp = null;
        let fromPayPal = null, toPayPal = null;
        let fromAccountId = null, toAccountId = null;

        if (method === 'CASHAPP') {
            // Get sender's CashApp account
            const fromAccount = await prisma.paymentAccount.findFirst({
                where: {
                    userId: fromUserId,
                    accountType: 'CASHAPP',
                    isDefault: true
                }
            });

            // Get receiver's CashApp account
            const toAccount = await prisma.paymentAccount.findFirst({
                where: {
                    userId: toUserId,
                    accountType: 'CASHAPP',
                    isDefault: true
                }
            });

            if (!fromAccount) {
                const senderRole = payerRole === "LENDER" ? "lender" : "borrower";
                return res.status(400).json({
                    error: `${senderRole} needs to add a CashApp account first`,
                    requiresAccount: senderRole
                });
            }

            if (!toAccount) {
                const receiverRole = receiverRole === "LENDER" ? "lender" : "borrower";
                return res.status(400).json({
                    error: `${receiverRole} needs to add a CashApp account first`,
                    requiresAccount: receiverRole
                });
            }

            fromCashApp = fromAccount.cashAppHandle;
            toCashApp = toAccount.cashAppHandle;
            fromAccountId = fromAccount.id;
            toAccountId = toAccount.id;

            console.log(`Payment setup: ${fromCashApp} → ${toCashApp} ($${amount})`);
        }

        if (method === 'PAYPAL') {
            // Get sender's PayPal account
            const fromAccount = await prisma.paymentAccount.findFirst({
                where: {
                    userId: fromUserId,
                    accountType: 'PAYPAL',
                    isDefault: true
                }
            });

            // Get receiver's PayPal account
            const toAccount = await prisma.paymentAccount.findFirst({
                where: {
                    userId: toUserId,
                    accountType: 'PAYPAL',
                    isDefault: true
                }
            });

            if (!fromAccount) {
                const senderRole = payerRole === "LENDER" ? "lender" : "borrower";
                return res.status(400).json({
                    error: `${senderRole} needs to add a PayPal account first`,
                    requiresAccount: senderRole
                });
            }

            if (!toAccount) {
                const receiverRole = receiverRole === "LENDER" ? "lender" : "borrower";
                return res.status(400).json({
                    error: `${receiverRole} needs to add a PayPal account first`,
                    requiresAccount: receiverRole
                });
            }

            fromPayPal = fromAccount.paypalEmail;
            toPayPal = toAccount.paypalEmail;
            fromAccountId = fromAccount.id;
            toAccountId = toAccount.id;

            console.log(`PayPal payment setup: ${fromPayPal} → ${toPayPal} ($${amount})`);
        }

        // Step 1: Create payment with confirmed = false
        const payment = await prisma.payment.create({
            data: {
                loanId,
                amount,
                method,
                payerRole,
                receiverRole,
                paymentDate: new Date(),
                confirmed: false,
                fromAccountId,
                toAccountId,
                transferStatus: 'PENDING',
                // Set manual confirmation status for manual payment methods
                manualConfirmationStatus: (method === 'CASHAPP' || method === 'ZELLE') ? 'PENDING_UPLOAD' : 'NONE'
            },
        });

        // Step 2: Handle manual payment methods differently
        if (method === 'CASHAPP' || method === 'ZELLE') {
            // For manual payments where lender is funding the loan, update loan status to FUNDED
            if (payerRole === 'LENDER' && receiverRole === 'BORROWER') {
                await prisma.loan.update({
                    where: { id: loanId },
                    data: { status: "FUNDED" },
                });
                console.log(`📈 Loan ${loanId} status updated to FUNDED via ${method} manual payment`);
            }
            
            // For manual payments, return immediately with payment data for manual confirmation
            return res.json({
                success: true,
                payment: {
                    ...payment,
                    requiresManualConfirmation: true,
                    message: `Please proceed with manual ${method} transfer and provide confirmation`
                }
            });
        }

        // Step 3: Call payment processing API for automated methods
        let paymentResponse;
        
        if (method === 'CASHAPP') {
            paymentResponse = await callCashAppAPI({
                amount,
                method,
                payerRole,
                receiverRole,
                fromCashApp,
                toCashApp
            });
        } else if (method === 'PAYPAL') {
            if (payerRole === 'LENDER') {
                // For loan funding: Lender pays via PayPal, then we send payout to borrower
                paymentResponse = await createPayPalPayment({
                    amount,
                    payerRole,
                    receiverRole,
                    loanId
                });
            } else {
                // For loan repayment: Borrower pays via PayPal 
                paymentResponse = await createPayPalPayment({
                    amount,
                    payerRole,
                    receiverRole,
                    loanId
                });
            }
        } else if (method === 'INTERNAL_WALLET') {
            // Internal wallet - just simulate success for immediate processing
            paymentResponse = {
                success: true,
                transactionId: `internal_${Date.now()}`,
                message: 'Internal wallet transaction processed'
            };
        } else {
            // Default to existing CashApp flow
            paymentResponse = await callCashAppAPI({
                amount,
                method,
                payerRole,
                receiverRole,
                fromCashApp,
                toCashApp
            });
        }

        console.log("Payment API response:", paymentResponse);

        if (paymentResponse.success) {
            // For CashApp/Stripe payments, we need to return the client secret for frontend processing
            if (method === 'CASHAPP' && paymentResponse.clientSecret) {
                console.log("inside paymentResponse.clientSecret");

                return res.json({
                    ...payment,
                    clientSecret: paymentResponse.clientSecret,
                    transactionId: paymentResponse.transactionId,
                    requiresAction: true,
                    fromCashApp,
                    toCashApp
                });
            }

            // For PayPal payments, return approval URL
            if (method === 'PAYPAL' && paymentResponse.approvalUrl) {
                console.log("PayPal payment created, redirecting to approval");

                return res.json({
                    ...payment,
                    approvalUrl: paymentResponse.approvalUrl,
                    paymentId: paymentResponse.paymentId,
                    transactionId: paymentResponse.transactionId,
                    requiresAction: true,
                    method: 'PAYPAL',
                    fromPayPal,
                    toPayPal
                });
            }

            // For internal wallet, process immediately
            if (method === 'INTERNAL_WALLET') {
                console.log("Processing internal wallet transaction immediately");

                // Update payment as confirmed
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        confirmed: true,
                        transferStatus: 'COMPLETED'
                    },
                });

                console.log("payerRole:", payerRole, "receiverRole:", receiverRole);

                // Update loan status logic
                if (payerRole === "LENDER") {
                    await prisma.loan.update({
                        where: { id: loanId },
                        data: { status: "FUNDED" },
                    });
                    console.log(`📈 Loan ${loanId} status updated to FUNDED via internal wallet`);
                }

                if (payerRole === "BORROWER") {
                    const totalRepaid = loan.payments
                        .filter(p => p.confirmed && p.payerRole === 'BORROWER' && p.receiverRole === 'LENDER')
                        .reduce((sum, p) => sum + p.amount, 0) + amount;

                    console.log(`Total repaid so far: $${totalRepaid}`);

                    if (totalRepaid >= loan.totalPayable) {
                        await prisma.loan.update({
                            where: { id: loanId },
                            data: { status: "COMPLETED" },
                        });
                        console.log(`🎉 Loan ${loanId} status updated to COMPLETED via internal wallet`);
                    }
                }

                return res.json({ 
                    ...payment, 
                    confirmed: true,
                    transferStatus: 'COMPLETED',
                    transactionId: paymentResponse.transactionId
                });
            }

            //     console.log("reached step 3");


            //     // Step 3: Update payment as confirmed for non-Stripe methods
            //     await prisma.payment.update({
            //         where: { id: payment.id },
            //         data: {
            //             confirmed: true,
            //             transferStatus: 'COMPLETED'
            //         },
            //     });

            //     console.log("payerRole:", payerRole, "receiverRole:", receiverRole);

            //     // Step 4: Loan update logic
            //     if (payerRole === "LENDER") {
            //         await prisma.loan.update({
            //             where: { id: loanId },
            //             data: { status: "FUNDED" },
            //         });
            //     }

            //     if (payerRole === "BORROWER") {
            //         // const totalRepaid =
            //         //     loan.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
            //         const totalRepaid = loan.payments
            //             .filter(p => p.confirmed && p.payerRole === 'BORROWER' && p.receiverRole === 'LENDER')
            //             .reduce((sum, p) => sum + p.amount, 0) + amount;

            //         console.log(`Total repaid so far: $${totalRepaid}`);

            //         if (totalRepaid >= loan.totalPayable) {
            //             await prisma.loan.update({
            //                 where: { id: loanId },
            //                 data: { status: "COMPLETED" },
            //             });
            //         }
            //     }

            //     return res.json({ ...payment, confirmed: true });


        }

        // If payment API failed
        return res.status(400).json({ error: paymentResponse.error || "Payment processing failed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payment/confirm-stripe - Confirm Stripe payment
router.post("/confirm-stripe", async (req, res) => {
    const { paymentIntentId, paymentId } = req.body;

    console.log("inside /confirm-stripe endpoint");

    try {
        const confirmResult = await confirmStripePayment(paymentIntentId);

        if (confirmResult.success) {
            // Get payment with account details
            const payment = await prisma.payment.findUnique({
                where: { id: paymentId },
                include: {
                    fromAccount: true,
                    toAccount: true,
                    loan: {
                        include: { payments: true }
                    }
                }
            });

            console.log("Payment fetched for confirmation:", payment);


            if (!payment) {
                return res.status(404).json({ error: "Payment not found" });
            }

            // Update payment status to processing
            await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    confirmed: true,
                    transferStatus: 'PROCESSING',
                    stripePaymentIntentId: paymentIntentId
                }
            });

            // Update transfer status to completed since Stripe payment succeeded
            // Note: Actual CashApp transfer must be done manually by users
            await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    transferStatus: 'COMPLETED'
                }
            });

            console.log(`✅ Stripe payment completed. Manual CashApp transfer required: ${payment.fromAccount?.cashAppHandle || 'N/A'} → ${payment.toAccount?.cashAppHandle || 'N/A'}`);
            
            // Create notification for manual CashApp transfer
            if (payment.fromAccount && payment.toAccount) {
                const transferMessage = payment.payerRole === 'LENDER' 
                    ? `Please manually send $${payment.amount} via CashApp to ${payment.toAccount.cashAppHandle} (borrower) to complete the loan funding.`
                    : `Please manually send $${payment.amount} via CashApp to ${payment.toAccount.cashAppHandle} (lender) to complete the loan repayment.`;
                
                // Create notification for the payer
                await prisma.notification.create({
                    data: {
                        userId: payment.payerRole === 'LENDER' ? payment.loan.lenderId : payment.loan.borrowerId,
                        loanId: payment.loanId,
                        type: 'PAYMENT_CONFIRMED',
                        message: transferMessage
                    }
                });
            }

            console.log("reached step line 264");
            console.log("Payment fetched for confirmation:", payment);

            // Update loan status logic
            const loan = payment.loan;

            console.log("link 270 ");
            console.log("payerrole:", payment.payerRole);

            if (payment.payerRole === "LENDER") {
                await prisma.loan.update({
                    where: { id: loan.id },
                    data: { status: "FUNDED" },
                });
                console.log(`📈 Loan ${loan.id} status updated to FUNDED`);
            }

            console.log("link 278 ");
            console.log("payerrole:", payment.payerRole);

            if (payment.payerRole === "BORROWER") {
                const totalRepaid = loan.payments
                    .filter(p => p.confirmed && p.payerRole === 'BORROWER' && p.receiverRole === 'LENDER')
                    .reduce((sum, p) => sum + p.amount, 0) + payment.amount;

                console.log(`Total repaid so far for loan ${loan.id}: $${totalRepaid}`);
                console.log(`Loan total payable: $${loan.totalPayable}`);

                if (totalRepaid >= loan.totalPayable) {
                    await prisma.loan.update({
                        where: { id: loan.id },
                        data: { status: "COMPLETED" },
                    });
                    console.log(`🎉 Loan ${loan.id} status updated to COMPLETED`);
                }
            }

            return res.json({
                success: true,
                payment: {
                    ...payment,
                    confirmed: true,
                    transferStatus: 'COMPLETED'
                }
            });
        }

        return res.status(400).json({ error: confirmResult.error || "Payment confirmation failed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payment/confirm-paypal - Confirm PayPal payment and execute payout
router.post("/confirm-paypal", async (req, res) => {
    const { paymentId, payerId, dbPaymentId } = req.body;

    console.log("inside /confirm-paypal endpoint");

    try {
        // Execute PayPal payment
        const confirmResult = await executePayPalPayment(paymentId, payerId);

        if (confirmResult.success) {
            // Get payment with account details
            const payment = await prisma.payment.findUnique({
                where: { id: dbPaymentId },
                include: {
                    fromAccount: true,
                    toAccount: true,
                    loan: {
                        include: { payments: true }
                    }
                }
            });

            if (!payment) {
                return res.status(404).json({ error: "Payment not found" });
            }

            // Update payment status
            await prisma.payment.update({
                where: { id: dbPaymentId },
                data: {
                    confirmed: true,
                    transferStatus: 'PROCESSING',
                    stripePaymentIntentId: paymentId // Store PayPal payment ID
                }
            });

            // If this is a loan funding (lender paying), send payout to borrower
            if (payment.payerRole === 'LENDER' && payment.toAccount?.paypalEmail) {
                console.log(`🚀 Initiating PayPal payout to borrower...`);
                
                const payoutResult = await sendPayPalPayout({
                    amount: payment.amount,
                    recipientEmail: payment.toAccount.paypalEmail,
                    payerRole: payment.payerRole,
                    receiverRole: payment.receiverRole,
                    loanId: payment.loanId
                });

                if (payoutResult.success) {
                    await prisma.payment.update({
                        where: { id: dbPaymentId },
                        data: {
                            transferStatus: 'COMPLETED',
                            cashAppTransactionId: payoutResult.payoutBatchId
                        }
                    });

                    console.log(`✅ PayPal payout completed: ${payment.fromAccount.paypalEmail} → ${payment.toAccount.paypalEmail}`);
                } else {
                    await prisma.payment.update({
                        where: { id: dbPaymentId },
                        data: {
                            transferStatus: 'FAILED'
                        }
                    });

                    console.log(`❌ PayPal payout failed: ${payoutResult.error}`);
                    return res.status(400).json({ error: payoutResult.error });
                }
            } else {
                // For repayments, mark as completed (money goes to platform, then manual payout)
                await prisma.payment.update({
                    where: { id: dbPaymentId },
                    data: {
                        transferStatus: 'COMPLETED'
                    }
                });

                // For borrower repayments, you might want to manually send payout to lender
                if (payment.payerRole === 'BORROWER' && payment.toAccount?.paypalEmail) {
                    console.log(`💰 Borrower repayment received. Consider sending payout to lender: ${payment.toAccount.paypalEmail}`);
                    
                    // Optionally auto-send payout to lender
                    const payoutResult = await sendPayPalPayout({
                        amount: payment.amount,
                        recipientEmail: payment.toAccount.paypalEmail,
                        payerRole: payment.payerRole,
                        receiverRole: payment.receiverRole,
                        loanId: payment.loanId
                    });

                    if (payoutResult.success) {
                        await prisma.payment.update({
                            where: { id: dbPaymentId },
                            data: {
                                cashAppTransactionId: payoutResult.payoutBatchId
                            }
                        });
                    }
                }
            }

            // Update loan status logic (same as before)
            const loan = payment.loan;
            
            if (payment.payerRole === "LENDER") {
                await prisma.loan.update({
                    where: { id: loan.id },
                    data: { status: "FUNDED" },
                });
                console.log(`📈 Loan ${loan.id} status updated to FUNDED`);
            }

            if (payment.payerRole === "BORROWER") {
                const totalRepaid = loan.payments
                    .filter(p => p.confirmed && p.payerRole === 'BORROWER' && p.receiverRole === 'LENDER')
                    .reduce((sum, p) => sum + p.amount, 0) + payment.amount;

                console.log(`Total repaid so far for loan ${loan.id}: $${totalRepaid}`);
                console.log(`Loan total payable: $${loan.totalPayable}`);

                if (totalRepaid >= loan.totalPayable) {
                    await prisma.loan.update({
                        where: { id: loan.id },
                        data: { status: "COMPLETED" },
                    });
                    console.log(`🎉 Loan ${loan.id} status updated to COMPLETED`);
                }
            }

            return res.json({
                success: true,
                payment: {
                    ...payment,
                    confirmed: true,
                    transferStatus: 'COMPLETED'
                }
            });
        }

        return res.status(400).json({ error: confirmResult.error || "PayPal payment confirmation failed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payment/confirm-cashapp - Confirm manual CashApp transfer
router.post("/confirm-cashapp", async (req, res) => {
    const { paymentId, cashAppTransactionId, confirmationNote } = req.body;

    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                fromAccount: true,
                toAccount: true,
                loan: {
                    include: { payments: true }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        if (payment.transferStatus !== 'COMPLETED') {
            return res.status(400).json({ error: "Stripe payment must be completed first" });
        }

        // Update payment with CashApp confirmation details
        await prisma.payment.update({
            where: { id: paymentId },
            data: {
                transferStatus: 'COMPLETED',
                cashAppTransactionId: cashAppTransactionId || null,
                confirmationNote: confirmationNote || null
            }
        });

        // Create confirmation notification
        const recipientUserId = payment.receiverRole === 'LENDER' ? payment.loan.lenderId : payment.loan.borrowerId;
        await prisma.notification.create({
            data: {
                userId: recipientUserId,
                loanId: payment.loanId,
                type: 'PAYMENT_CONFIRMED',
                message: `CashApp transfer of $${payment.amount} has been confirmed. ${confirmationNote || ''}`
            }
        });

        // Update loan status logic (same as before)
        const loan = payment.loan;
        
        if (payment.payerRole === "LENDER") {
            await prisma.loan.update({
                where: { id: loan.id },
                data: { status: "FUNDED" },
            });
        }

        if (payment.payerRole === "BORROWER") {
            const totalRepaid = loan.payments
                .filter(p => p.confirmed && p.payerRole === 'BORROWER' && p.receiverRole === 'LENDER')
                .reduce((sum, p) => sum + p.amount, 0) + payment.amount;

            if (totalRepaid >= loan.totalPayable) {
                await prisma.loan.update({
                    where: { id: loan.id },
                    data: { status: "COMPLETED" },
                });
            }
        }

        return res.json({
            success: true,
            message: "CashApp transfer confirmed successfully"
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payment/loan/:loanId - Get all payments for a specific loan
router.get("/loan/:loanId", async (req, res) => {
    const { loanId } = req.params;

    try {
        const payments = await prisma.payment.findMany({
            where: { loanId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ payments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;