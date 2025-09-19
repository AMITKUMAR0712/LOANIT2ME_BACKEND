/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payment` DROP COLUMN `updatedAt`;

-- CreateTable
CREATE TABLE `PaymentAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountType` ENUM('CASHAPP', 'ZELLE', 'INTERNAL_WALLET') NOT NULL,
    `cashAppHandle` VARCHAR(191) NULL,
    `accountNickname` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentAccount_userId_accountType_idx`(`userId`, `accountType`),
    UNIQUE INDEX `PaymentAccount_userId_cashAppHandle_key`(`userId`, `cashAppHandle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PaymentAccount` ADD CONSTRAINT `PaymentAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
