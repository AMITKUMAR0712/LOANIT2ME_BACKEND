-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('LENDER', 'BORROWER', 'ADMIN') NOT NULL DEFAULT 'BORROWER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Relationship` (
    `id` VARCHAR(191) NOT NULL,
    `lenderId` VARCHAR(191) NOT NULL,
    `borrowerId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'BLOCKED') NOT NULL DEFAULT 'CONFIRMED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Relationship_lenderId_borrowerId_key`(`lenderId`, `borrowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LenderTerm` (
    `id` VARCHAR(191) NOT NULL,
    `lenderId` VARCHAR(191) NOT NULL,
    `maxLoanAmount` DOUBLE NOT NULL,
    `loanMultiple` DOUBLE NOT NULL DEFAULT 10,
    `maxPaybackDays` INTEGER NOT NULL,
    `feePer10Short` DOUBLE NOT NULL,
    `feePer10Long` DOUBLE NOT NULL,
    `allowMultipleLoans` BOOLEAN NOT NULL DEFAULT false,
    `inviteToken` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LenderTerm_inviteToken_key`(`inviteToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Loan` (
    `id` VARCHAR(191) NOT NULL,
    `lenderId` VARCHAR(191) NOT NULL,
    `borrowerId` VARCHAR(191) NOT NULL,
    `lenderTermId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `dateBorrowed` DATETIME(3) NOT NULL,
    `paybackDate` DATETIME(3) NOT NULL,
    `feeAmount` DOUBLE NOT NULL,
    `totalPayable` DOUBLE NOT NULL,
    `status` ENUM('PENDING', 'FUNDED', 'DENIED', 'OVERDUE', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `health` ENUM('GOOD', 'BEHIND', 'FAILING', 'DEFAULTED') NOT NULL DEFAULT 'GOOD',
    `agreementText` VARCHAR(191) NOT NULL,
    `signedBy` VARCHAR(191) NOT NULL,
    `signedDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `loanId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `method` ENUM('CASHAPP', 'ZELLE', 'INTERNAL_WALLET') NOT NULL,
    `confirmed` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `loanId` VARCHAR(191) NULL,
    `type` ENUM('PAYMENT_OVERDUE', 'PAYMENT_CONFIRMED', 'LOAN_REQUEST', 'LOAN_APPROVED', 'LOAN_DENIED', 'LOAN_FUNDED') NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Relationship` ADD CONSTRAINT `Relationship_lenderId_fkey` FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Relationship` ADD CONSTRAINT `Relationship_borrowerId_fkey` FOREIGN KEY (`borrowerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LenderTerm` ADD CONSTRAINT `LenderTerm_lenderId_fkey` FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_lenderId_fkey` FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_borrowerId_fkey` FOREIGN KEY (`borrowerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_lenderTermId_fkey` FOREIGN KEY (`lenderTermId`) REFERENCES `LenderTerm`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
