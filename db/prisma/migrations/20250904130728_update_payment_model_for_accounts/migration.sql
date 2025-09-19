-- AlterTable
ALTER TABLE `payment` ADD COLUMN `fromAccountId` VARCHAR(191) NULL,
    ADD COLUMN `stripePaymentIntentId` VARCHAR(191) NULL,
    ADD COLUMN `toAccountId` VARCHAR(191) NULL,
    ADD COLUMN `transferStatus` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_fromAccountId_fkey` FOREIGN KEY (`fromAccountId`) REFERENCES `PaymentAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_toAccountId_fkey` FOREIGN KEY (`toAccountId`) REFERENCES `PaymentAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
