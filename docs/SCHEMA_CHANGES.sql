-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `accountEmail` VARCHAR(191) NULL,
    ADD COLUMN `accountPhone` VARCHAR(191) NULL,
    ADD COLUMN `authVersion` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `pricingSnapshot` JSON NULL;

-- AlterTable
ALTER TABLE `Session` ADD COLUMN `pricingSnapshot` JSON NULL;

-- AlterTable
ALTER TABLE `AttendanceLog` ADD COLUMN `loginSessionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Customer_accountPhone_key` ON `Customer`(`accountPhone`);

-- CreateIndex
CREATE UNIQUE INDEX `Customer_accountEmail_key` ON `Customer`(`accountEmail`);

-- CreateIndex
CREATE INDEX `Customer_resetToken_idx` ON `Customer`(`resetToken`);

-- CreateIndex
CREATE INDEX `Customer_email_idx` ON `Customer`(`email`);

-- CreateIndex
CREATE INDEX `Session_resourceId_status_idx` ON `Session`(`resourceId`, `status`);

-- CreateIndex
CREATE INDEX `AttendanceLog_loginSessionId_idx` ON `AttendanceLog`(`loginSessionId`);
