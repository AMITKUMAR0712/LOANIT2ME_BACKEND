import { prisma } from '../db/index.js';
import { logActivity, AuditActions, createLogDetails } from '../utils/auditLogger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/payment-screenshots';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `payment-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

export const uploadScreenshot = upload.single('screenshot');

export const handleScreenshotUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    
    res.json({ 
      success: true, 
      message: 'Screenshot uploaded successfully',
      filePath: filePath
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    res.status(500).json({ success: false, message: 'Failed to upload screenshot' });
  }
};

export const submitManualProof = async (req, res) => {
  try {
    const { paymentId, transactionId, note, screenshotPath, userRole } = req.body;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Payment ID is required' });
    }

    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        loan: {
          include: {
            lender: true,
            borrower: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Update payment with proof
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        cashAppTransactionId: transactionId || payment.cashAppTransactionId,
        confirmationNote: note || payment.confirmationNote,
        confirmationScreenshot: screenshotPath || payment.confirmationScreenshot,
        manualConfirmationStatus: 'PENDING_CONFIRMATION'
      },
      include: {
        loan: {
          include: {
            lender: true,
            borrower: true
          }
        }
      }
    });

    // Log the activity
    await logActivity(
      req.userId,
      AuditActions.PAYMENT_PROOF_SUBMITTED,
      createLogDetails(`Payment proof submitted by ${userRole}`, {
        // paymentId,
        // loanId: payment.loanId,
        amount: payment.amount,
        // hasTransactionId: !!transactionId,
        // hasScreenshot: !!screenshotPath,
        submittedBy: userRole
      })
    );

    // Create notifications for the other party
    const otherUserId = userRole === 'LENDER' ? payment.loan.borrowerId : payment.loan.lenderId;
    await prisma.notification.create({
      data: {
        userId: otherUserId,
        loanId: payment.loanId,
        type: 'PAYMENT_CONFIRMED',
        message: `Payment proof submitted for ${payment.method} payment of $${payment.amount}. Please review and confirm.`,
        isRead: false
      }
    });

    res.json({ 
      success: true, 
      message: 'Payment proof submitted successfully',
      payment: updatedPayment
    });
  } catch (error) {
    console.error('Error submitting manual proof:', error);
    res.status(500).json({ success: false, message: 'Failed to submit payment proof' });
  }
};

export const confirmManualPayment = async (req, res) => {
  try {
    const { paymentId, confirmed, userRole, note } = req.body;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Payment ID is required' });
    }

    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        loan: {
          include: {
            lender: true,
            borrower: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Update confirmation status based on user role
    const updateData = {
      confirmationNote: note ? `${payment.confirmationNote || ''}\n${userRole}: ${note}`.trim() : payment.confirmationNote
    };

    if (userRole === 'LENDER') {
      updateData.lenderConfirmed = confirmed;
    } else if (userRole === 'BORROWER') {
      updateData.borrowerConfirmed = confirmed;
    }

    // Determine the overall status
    const otherUserConfirmed = userRole === 'LENDER' ? payment.borrowerConfirmed : payment.lenderConfirmed;
    
    if (!confirmed) {
      // If disputed, mark as disputed
      updateData.manualConfirmationStatus = 'DISPUTED';
      updateData.confirmed = false;
    } else if (confirmed && otherUserConfirmed) {
      // If both confirmed, mark as confirmed
      updateData.manualConfirmationStatus = 'CONFIRMED';
      updateData.confirmed = true;
      updateData.transferStatus = 'COMPLETED';
    } else if (confirmed) {
      // If this user confirmed (but other hasn't yet)
      // For repayments, when lender confirms, mark payment as confirmed immediately
      if (payment.payerRole === 'BORROWER' && payment.receiverRole === 'LENDER' && userRole === 'LENDER') {
        updateData.confirmed = true;
        updateData.transferStatus = 'COMPLETED';
        updateData.manualConfirmationStatus = 'CONFIRMED';
      }
      // For funding payments, when borrower confirms, mark as confirmed immediately
      else if (payment.payerRole === 'LENDER' && payment.receiverRole === 'BORROWER' && userRole === 'BORROWER') {
        updateData.confirmed = true;
        updateData.transferStatus = 'COMPLETED';
        updateData.manualConfirmationStatus = 'CONFIRMED';
      }
    }
    // If only one confirmed and it's not the cases above, keep as PENDING_CONFIRMATION

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        loan: {
          include: {
            lender: true,
            borrower: true,
            payments: true
          }
        }
      }
    });

    // Handle loan status updates for funding payments
    if (confirmed && payment.payerRole === 'LENDER' && payment.receiverRole === 'BORROWER') {
      // This is a funding payment - when borrower confirms receipt, loan should become ACTIVE
      if (userRole === 'BORROWER') {
        await prisma.loan.update({
          where: { id: payment.loanId },
          data: { status: "ACTIVE" }
        });
        console.log(`📈 Loan ${payment.loanId} status updated to ACTIVE after borrower confirmed funding receipt`);
      }
    }

    // Handle loan completion for repayment payments
    if (confirmed && payment.payerRole === 'BORROWER' && payment.receiverRole === 'LENDER') {
      // This is a repayment - check if loan is fully paid when lender confirms
      if (userRole === 'LENDER' && updateData.confirmed) {
        // Get fresh loan data with all payments to ensure accurate calculation
        const loanWithPayments = await prisma.loan.findUnique({
          where: { id: payment.loanId },
          include: { payments: true }
        });
        
        // Calculate total of all confirmed repayment payments
        const totalRepaid = loanWithPayments.payments
          .filter(p => p.confirmed && p.payerRole === 'BORROWER' && p.receiverRole === 'LENDER')
          .reduce((sum, p) => sum + p.amount, 0);

        console.log(`Loan ${payment.loanId} repayment check:`);
        console.log(`- All confirmed repayments: $${totalRepaid}`);
        console.log(`- Total payable: $${loanWithPayments.totalPayable}`);

        if (totalRepaid >= loanWithPayments.totalPayable) {
          await prisma.loan.update({
            where: { id: payment.loanId },
            data: { status: "COMPLETED" }
          });
          console.log(`🎉 Loan ${payment.loanId} status updated to COMPLETED after lender confirmed repayment`);
        }
      }
    }

    // Log the activity
    await logActivity(
      req.userId,
      confirmed ? AuditActions.PAYMENT_CONFIRMED : AuditActions.PAYMENT_DISPUTED,
      createLogDetails(`Payment ${confirmed ? 'confirmed' : 'disputed'} by ${userRole}`, {
        // paymentId,
        // loanId: payment.loanId,
        amount: payment.amount,
        confirmedBy: userRole,
        finalStatus: updateData.manualConfirmationStatus
      })
    );

    // Create notifications
    const otherUserId = userRole === 'LENDER' ? payment.loan.borrowerId : payment.loan.lenderId;
    
    if (updateData.manualConfirmationStatus === 'CONFIRMED') {
      // Notify both parties that payment is fully confirmed
      await prisma.notification.createMany({
        data: [
          {
            userId: payment.loan.lenderId,
            loanId: payment.loanId,
            type: 'PAYMENT_CONFIRMED',
            message: `Payment of $${payment.amount} has been confirmed by both parties.`,
            isRead: false
          },
          {
            userId: payment.loan.borrowerId,
            loanId: payment.loanId,
            type: 'PAYMENT_CONFIRMED',
            message: `Payment of $${payment.amount} has been confirmed by both parties.`,
            isRead: false
          }
        ]
      });
    } else if (updateData.manualConfirmationStatus === 'DISPUTED') {
      // Notify about dispute
      await prisma.notification.create({
        data: {
          userId: otherUserId,
          loanId: payment.loanId,
          type: 'PAYMENT_CONFIRMED',
          message: `Payment of $${payment.amount} has been disputed. Please review.`,
          isRead: false
        }
      });
    } else {
      // Notify about partial confirmation
      await prisma.notification.create({
        data: {
          userId: otherUserId,
          loanId: payment.loanId,
          type: 'PAYMENT_CONFIRMED',
          message: `Payment of $${payment.amount} has been ${confirmed ? 'confirmed' : 'disputed'} by ${userRole}. Waiting for your confirmation.`,
          isRead: false
        }
      });
    }

    res.json({ 
      success: true, 
      message: `Payment ${confirmed ? 'confirmed' : 'disputed'} successfully`,
      payment: updatedPayment
    });
  } catch (error) {
    console.error('Error confirming manual payment:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm payment' });
  }
};

export const getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        loan: {
          include: {
            lender: true,
            borrower: true
          }
        },
        fromAccount: true,
        toAccount: true
      }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ 
      success: true, 
      payment
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment details' });
  }
};

export const validatePaymentMethods = async (req, res) => {
  try {
    const { lenderTermId, borrowerId } = req.body;

    // Get lender term with preferred payment methods
    const lenderTerm = await prisma.lenderTerm.findUnique({
      where: { id: lenderTermId }
    });

    if (!lenderTerm) {
      return res.status(404).json({ success: false, message: 'Lender term not found' });
    }

    // If no preferred methods are set or matching not required, allow all
    if (!lenderTerm.preferredPaymentMethods || !lenderTerm.requireMatchingPaymentMethod) {
      return res.json({ 
        success: true, 
        valid: true, 
        message: 'All payment methods allowed'
      });
    }

    // Parse preferred payment methods
    let preferredMethods = [];
    try {
      preferredMethods = JSON.parse(lenderTerm.preferredPaymentMethods || '[]');
    } catch (error) {
      console.error('Error parsing preferred payment methods:', error);
      preferredMethods = [];
    }

    if (preferredMethods.length === 0) {
      return res.json({ 
        success: true, 
        valid: true, 
        message: 'No preferred payment methods set'
      });
    }

    // Get borrower's payment accounts
    const borrowerAccounts = await prisma.paymentAccount.findMany({
      where: { 
        userId: borrowerId,
        isVerified: true
      }
    });

    // Check if borrower has any of the preferred payment methods
    const borrowerMethods = borrowerAccounts.map(account => account.accountType);
    const hasMatchingMethod = preferredMethods.some(method => borrowerMethods.includes(method));

    res.json({ 
      success: true, 
      valid: hasMatchingMethod,
      preferredMethods,
      borrowerMethods,
      message: hasMatchingMethod 
        ? 'Borrower has matching payment method'
        : 'Borrower does not have any of the preferred payment methods'
    });
  } catch (error) {
    console.error('Error validating payment methods:', error);
    res.status(500).json({ success: false, message: 'Failed to validate payment methods' });
  }
};
