-- AlterTable
ALTER TABLE `lenderterm` ADD COLUMN `preferredPaymentMethods` VARCHAR(191) NULL,
    ADD COLUMN `requireMatchingPaymentMethod` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `borrowerConfirmed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `confirmationScreenshot` VARCHAR(191) NULL,
    ADD COLUMN `lenderConfirmed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `manualConfirmationStatus` ENUM('NONE', 'PENDING_UPLOAD', 'PENDING_CONFIRMATION', 'CONFIRMED', 'DISPUTED') NOT NULL DEFAULT 'NONE';
