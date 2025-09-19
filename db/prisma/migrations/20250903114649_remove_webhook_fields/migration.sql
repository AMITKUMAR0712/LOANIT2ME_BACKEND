/*
  Warnings:

  - You are about to drop the column `cashAppCustomerId` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `webhookEventId` on the `payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payment` DROP COLUMN `cashAppCustomerId`,
    DROP COLUMN `webhookEventId`;
