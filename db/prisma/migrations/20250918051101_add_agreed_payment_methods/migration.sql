-- AlterTable
ALTER TABLE `loan` ADD COLUMN `agreedPaymentAccountId` VARCHAR(191) NULL,
    ADD COLUMN `agreedPaymentMethod` ENUM('CASHAPP', 'PAYPAL', 'ZELLE', 'INTERNAL_WALLET') NULL;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_agreedPaymentAccountId_fkey` FOREIGN KEY (`agreedPaymentAccountId`) REFERENCES `PaymentAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
