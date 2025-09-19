import { prisma } from '../../db/index.js';
import { logActivity, AuditActions, createLogDetails } from '../../utils/auditLogger.js';

export const getLoans = async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      include: {
        lender: true,
        borrower: true,
        lenderTerm: true,
        payments: true,
      },
    });
    res.json({ loans });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ message: 'Failed to fetch loans' });
  }
};

export const updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, health } = req.body;

    // Get the loan before update for audit logging
    const loanBeforeUpdate = await prisma.loan.findUnique({
      where: { id },
      include: { lender: true, borrower: true },
    });

    const updatedLoan = await prisma.loan.update({
      where: { id },
      data: { status, health },
      include: { lender: true, borrower: true, lenderTerm: true },
    });

    // Log loan status change
    await logActivity(
      req.userId, // Assuming req.userId is set by verifyToken middleware
      AuditActions.LOAN_STATUS_CHANGE,
      createLogDetails("Loan status updated by admin", {
        // loanId: id,
        // previousStatus: loanBeforeUpdate.status,
        // newStatus: status,
        // previousHealth: loanBeforeUpdate.health,
        // newHealth: health,
        status: loanBeforeUpdate.status !== status ? status : undefined,
        health: loanBeforeUpdate.health !== health ? health : undefined,
        lenderName: loanBeforeUpdate.lender.fullName,
        borrowerName: loanBeforeUpdate.borrower.fullName,
        amount: loanBeforeUpdate.amount
      })
    );

    res.json({ message: 'Loan updated successfully', loan: updatedLoan });
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({ message: 'Failed to update loan' });
  }
};