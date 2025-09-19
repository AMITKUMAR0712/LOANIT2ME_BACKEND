import { prisma } from '../../db/index.js';
import { logActivity, AuditActions, createLogDetails } from '../../utils/auditLogger.js';

export const getPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        loan: {
          include: {
            borrower: true,
            lender: true
          }
        }
      },
    });
    res.json({ payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get payment before update for audit logging
    const paymentBeforeUpdate = await prisma.payment.findUnique({
      where: { id },
      include: { loan: { include: { borrower: true, lender: true } } },
    });
    
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { confirmed: true },
      include: { loan: true },
    });
    
    // Log payment confirmation
    await logActivity(
      req.userId,
      AuditActions.PAYMENT_CONFIRMED,
      createLogDetails("Payment confirmed by admin", {
        // paymentId: id,
        amount: paymentBeforeUpdate.amount,
        paymentMethod: paymentBeforeUpdate.method,
        // loanId: paymentBeforeUpdate.loanId,
        borrower: paymentBeforeUpdate.loan.borrower.fullName,
        lender: paymentBeforeUpdate.loan.lender.fullName
      })
    );
    
    res.json({ message: 'Payment confirmed successfully', payment: updatedPayment });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
};