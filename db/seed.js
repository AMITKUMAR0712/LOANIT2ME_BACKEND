import { prisma } from "./index.js";

async function main() {
  // Create Lender
  const lender = await prisma.user.create({
    data: {
      fullName: "Kinte Seay",
      email: "kinte1@example.com",
      phoneNumber: "555-111-2222",
      passwordHash: "hashed_password",
      role: "LENDER",
    },
  });

  // Create Borrower
  const borrower = await prisma.user.create({
    data: {
      fullName: "John Doe",
      email: "john1@example.com",
      phoneNumber: "555-333-4444",
      passwordHash: "hashed_password",
      role: "BORROWER",
    },
  });

  // Relationship
  await prisma.relationship.create({
    data: {
      lenderId: lender.id,
      borrowerId: borrower.id,
      status: "CONFIRMED",
    },
  });

  // Lender Term
  const lenderTerm = await prisma.lenderTerm.create({
    data: {
      lenderId: lender.id,
      maxLoanAmount: 100,
      loanMultiple: 10,
      maxPaybackDays: 14,
      feePer10Short: 1,
      feePer10Long: 2,
      allowMultipleLoans: false,
    },
  });

  // Loan Request Example
  await prisma.loan.create({
    data: {
      lenderId: lender.id,
      borrowerId: borrower.id,
      lenderTermId: lenderTerm.id,
      amount: 50,
      dateBorrowed: new Date("2025-08-07"),
      paybackDate: new Date("2025-08-14"),
      feeAmount: 10,
      totalPayable: 60,
      status: "PENDING",
      health: "GOOD",
      agreementText:
        "I",
      signedBy: "John Doe",
      signedDate: new Date("2025-08-07"),
    },
  });

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
