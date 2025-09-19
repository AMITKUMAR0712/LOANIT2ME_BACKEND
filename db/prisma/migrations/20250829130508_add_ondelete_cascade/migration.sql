-- DropForeignKey
ALTER TABLE `auditlog` DROP FOREIGN KEY `AuditLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `lenderterm` DROP FOREIGN KEY `LenderTerm_lenderId_fkey`;

-- DropForeignKey
ALTER TABLE `loan` DROP FOREIGN KEY `Loan_borrowerId_fkey`;

-- DropForeignKey
ALTER TABLE `loan` DROP FOREIGN KEY `Loan_lenderId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_userId_fkey`;

-- DropForeignKey
ALTER TABLE `relationship` DROP FOREIGN KEY `Relationship_borrowerId_fkey`;

-- DropForeignKey
ALTER TABLE `relationship` DROP FOREIGN KEY `Relationship_lenderId_fkey`;

-- DropIndex
DROP INDEX `AuditLog_userId_fkey` ON `auditlog`;

-- DropIndex
DROP INDEX `LenderTerm_lenderId_fkey` ON `lenderterm`;

-- DropIndex
DROP INDEX `Loan_borrowerId_fkey` ON `loan`;

-- DropIndex
DROP INDEX `Loan_lenderId_fkey` ON `loan`;

-- DropIndex
DROP INDEX `Notification_userId_fkey` ON `notification`;

-- DropIndex
DROP INDEX `Relationship_borrowerId_fkey` ON `relationship`;

-- AddForeignKey
ALTER TABLE `Relationship` ADD CONSTRAINT `Relationship_lenderId_fkey` FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Relationship` ADD CONSTRAINT `Relationship_borrowerId_fkey` FOREIGN KEY (`borrowerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LenderTerm` ADD CONSTRAINT `LenderTerm_lenderId_fkey` FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_lenderId_fkey` FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_borrowerId_fkey` FOREIGN KEY (`borrowerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
