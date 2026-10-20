-- Run against your MySQL database (phpMyAdmin / MySQL client) if prisma migrate is not used.
-- If a column already exists, that single statement will error; skip it and continue.

ALTER TABLE `Article` ADD COLUMN `outline` LONGTEXT NULL;
ALTER TABLE `Article` ADD COLUMN `wpPostId` INTEGER NULL;
ALTER TABLE `Article` ADD COLUMN `targetSite` VARCHAR(191) NULL;
ALTER TABLE `Article` ADD COLUMN `scheduledAt` DATETIME(3) NULL;
ALTER TABLE `Article` ADD COLUMN `publishMeta` LONGTEXT NULL;
