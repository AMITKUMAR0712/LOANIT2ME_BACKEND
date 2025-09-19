/*
  Warnings:

  - You are about to drop the column `failureReason` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentIntentId` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payment` DROP COLUMN `failureReason`,
    DROP COLUMN `paymentIntentId`,
    DROP COLUMN `transactionId`;
