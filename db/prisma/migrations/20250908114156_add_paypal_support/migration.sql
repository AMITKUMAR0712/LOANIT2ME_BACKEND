/*
  Warnings:

  - A unique constraint covering the columns `[userId,paypalEmail]` on the table `PaymentAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `payment` ADD COLUMN `cashAppTransactionId` VARCHAR(191) NULL,
    ADD COLUMN `confirmationNote` VARCHAR(191) NULL,
    MODIFY `method` ENUM('CASHAPP', 'PAYPAL', 'ZELLE', 'INTERNAL_WALLET') NOT NULL;

-- AlterTable
ALTER TABLE `paymentaccount` ADD COLUMN `paypalEmail` VARCHAR(191) NULL,
    MODIFY `accountType` ENUM('CASHAPP', 'PAYPAL', 'ZELLE', 'INTERNAL_WALLET') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PaymentAccount_userId_paypalEmail_key` ON `PaymentAccount`(`userId`, `paypalEmail`);
