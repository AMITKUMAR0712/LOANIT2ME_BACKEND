import { prisma } from '../../db/index.js';
import { logActivity, AuditActions, createLogDetails } from '../../utils/auditLogger.js';

export const getLenderTerms = async (req, res) => {
  try {
    const lenderTerms = await prisma.lenderTerm.findMany({
      include: { lender: true, loans: true },
    });
    res.json({ lenderTerms });
  } catch (error) {
    console.error('Error fetching lender terms:', error);
    res.status(500).json({ message: 'Failed to fetch lender terms' });
  }
};

export const updateLenderTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      maxLoanAmount, 
      loanMultiple, 
      maxPaybackDays, 
      feePer10Short, 
      feePer10Long, 
      allowMultipleLoans,
      preferredPaymentMethods,
      requireMatchingPaymentMethod
    } = req.body;

    // Get term before update for audit logging
    const termBeforeUpdate = await prisma.lenderTerm.findUnique({
      where: { id },
      include: { lender: true }
    });

    if (!termBeforeUpdate) {
      return res.status(404).json({ message: 'Lender term not found' });
    }

    // Prepare update data
    const updateData = {};
    
    if (maxLoanAmount !== undefined) updateData.maxLoanAmount = parseFloat(maxLoanAmount);
    if (loanMultiple !== undefined) updateData.loanMultiple = parseFloat(loanMultiple);
    if (maxPaybackDays !== undefined) updateData.maxPaybackDays = parseInt(maxPaybackDays);
    if (feePer10Short !== undefined) updateData.feePer10Short = parseFloat(feePer10Short);
    if (feePer10Long !== undefined) updateData.feePer10Long = parseFloat(feePer10Long);
    if (allowMultipleLoans !== undefined) updateData.allowMultipleLoans = allowMultipleLoans;
    if (preferredPaymentMethods !== undefined) updateData.preferredPaymentMethods = preferredPaymentMethods;
    if (requireMatchingPaymentMethod !== undefined) updateData.requireMatchingPaymentMethod = requireMatchingPaymentMethod;

    const updatedTerm = await prisma.lenderTerm.update({
      where: { id },
      data: updateData,
      include: { lender: true }
    });

    // Log lender term update
    await logActivity(
      req.userId,
      AuditActions.TERM_UPDATED,
      createLogDetails("Lender term updated", {
        termId: id,
        lenderId: termBeforeUpdate.lenderId,
        lenderName: termBeforeUpdate.lender.fullName,
        changes: Object.keys(updateData)
      })
    );

    res.json({ success: true, message: 'Lender term updated successfully', lenderTerm: updatedTerm });
  } catch (error) {
    console.error('Error updating lender term:', error);
    res.status(500).json({ success: false, message: 'Failed to update lender term' });
  }
};