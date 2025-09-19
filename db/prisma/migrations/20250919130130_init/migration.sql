-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('LENDER', 'BORROWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."RelationshipStatus" AS ENUM ('PENDING', 'CONFIRMED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."LoanStatus" AS ENUM ('PENDING', 'FUNDED', 'ACTIVE', 'DENIED', 'OVERDUE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."LoanHealth" AS ENUM ('GOOD', 'BEHIND', 'FAILING', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASHAPP', 'PAYPAL', 'ZELLE', 'INTERNAL_WALLET');

-- CreateEnum
CREATE TYPE "public"."TransferStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ManualConfirmationStatus" AS ENUM ('NONE', 'PENDING_UPLOAD', 'PENDING_CONFIRMATION', 'CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('PAYMENT_OVERDUE', 'PAYMENT_CONFIRMED', 'LOAN_REQUEST', 'LOAN_APPROVED', 'LOAN_DENIED', 'LOAN_FUNDED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'BORROWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Relationship" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "status" "public"."RelationshipStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LenderTerm" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "maxLoanAmount" DOUBLE PRECISION NOT NULL,
    "loanMultiple" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxPaybackDays" INTEGER NOT NULL,
    "feePer10Short" DOUBLE PRECISION NOT NULL,
    "feePer10Long" DOUBLE PRECISION NOT NULL,
    "allowMultipleLoans" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT NOT NULL,
    "preferredPaymentMethods" TEXT,
    "requireMatchingPaymentMethod" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LenderTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Loan" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "lenderTermId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "dateBorrowed" TIMESTAMP(3) NOT NULL,
    "paybackDate" TIMESTAMP(3) NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "totalPayable" DOUBLE PRECISION NOT NULL,
    "status" "public"."LoanStatus" NOT NULL DEFAULT 'PENDING',
    "health" "public"."LoanHealth" NOT NULL DEFAULT 'GOOD',
    "agreementText" TEXT NOT NULL,
    "signedBy" TEXT NOT NULL,
    "signedDate" TIMESTAMP(3) NOT NULL,
    "agreedPaymentMethod" "public"."PaymentMethod",
    "agreedPaymentAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "payerRole" "public"."UserRole" NOT NULL DEFAULT 'LENDER',
    "receiverRole" "public"."UserRole" NOT NULL DEFAULT 'BORROWER',
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "transferStatus" "public"."TransferStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "cashAppTransactionId" TEXT,
    "confirmationNote" TEXT,
    "confirmationScreenshot" TEXT,
    "manualConfirmationStatus" "public"."ManualConfirmationStatus" NOT NULL DEFAULT 'NONE',
    "lenderConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "borrowerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountType" "public"."PaymentMethod" NOT NULL,
    "cashAppHandle" TEXT,
    "paypalEmail" TEXT,
    "accountNickname" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT,
    "type" "public"."NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_lenderId_borrowerId_key" ON "public"."Relationship"("lenderId", "borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "LenderTerm_inviteToken_key" ON "public"."LenderTerm"("inviteToken");

-- CreateIndex
CREATE INDEX "PaymentAccount_userId_accountType_idx" ON "public"."PaymentAccount"("userId", "accountType");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_userId_cashAppHandle_key" ON "public"."PaymentAccount"("userId", "cashAppHandle");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_userId_paypalEmail_key" ON "public"."PaymentAccount"("userId", "paypalEmail");

-- AddForeignKey
ALTER TABLE "public"."Relationship" ADD CONSTRAINT "Relationship_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Relationship" ADD CONSTRAINT "Relationship_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LenderTerm" ADD CONSTRAINT "LenderTerm_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_agreedPaymentAccountId_fkey" FOREIGN KEY ("agreedPaymentAccountId") REFERENCES "public"."PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_lenderTermId_fkey" FOREIGN KEY ("lenderTermId") REFERENCES "public"."LenderTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "public"."PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAccount" ADD CONSTRAINT "PaymentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
