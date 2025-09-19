import { prisma } from "../db/index.js";

export const getInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const term = await prisma.lenderTerm.findUnique({
      where: { inviteToken: token },
      include: { lender: true },
    });
    
    if (!term) return res.status(404).json({ error: "Invalid invite link" });

    res.json({
      lenderName: term.lender.fullName,
      lenderId: term.lenderId,
      loanRules: {
        maxLoanAmount: term.maxLoanAmount,
        maxPaybackDays: term.maxPaybackDays,
        feePer10Short: term.feePer10Short,
        loanMultiple: term.loanMultiple,
        feePer10Long: term.feePer10Long,
        allowMultipleLoans: term.allowMultipleLoans,

      },
    });
  } catch (error) {
    console.error('Error fetching invite details:', error);
    res.status(500).json({ error: "Failed to fetch invite details" });
  }
};

export const acceptInvite = async (req, res) => {
  try {
    const { token, borrowerData } = req.body;

    const term = await prisma.lenderTerm.findUnique({
      where: { inviteToken: token },
    });
    
    if (!term) return res.status(400).json({ error: "Invalid invite" });

    // console.log('Invite token found:', token);
    
    // console.log('Accepting invite for borrower:', borrowerData.email);
    
    // If borrower is already logged in
    let borrower = await prisma.user.findUnique({
      where: { email: borrowerData.email },
    });

    if (!borrower) {
      // Create new borrower if not exists
      borrower = await prisma.user.create({
        data: {
          ...borrowerData,
          role: "BORROWER",
        },
      });
    } else if (borrower.role === "LENDER") {
      // If user is a lender, they can't accept a borrower invite with the same account
      return res.status(400).json({ error: "Please use a different account. Lenders cannot be borrowers with the same account." });
    }

    // Create relationship (if not already)
    const existing = await prisma.relationship.findFirst({
      where: {
        lenderId: term.lenderId,
        borrowerId: borrower.id,
      },
    });

    if (!existing) {
      await prisma.relationship.create({
        data: {
          lenderId: term.lenderId,
          borrowerId: borrower.id,
          status: "CONFIRMED",
        },
      });
    }

    res.json({ success: true, borrower, lenderId: term.lenderId });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: "Failed to accept invite" });
  }
};