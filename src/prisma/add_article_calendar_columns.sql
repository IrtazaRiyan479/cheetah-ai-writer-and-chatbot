-- Run ONE statement at a time. Skip any that error with "Duplicate column name".

ALTER TABLE `Article` ADD COLUMN `scheduledAt` DATETIME(3) NULL;
ALTER TABLE `Article` ADD COLUMN `wpPostId` INTEGER NULL;
ALTER TABLE `Article` ADD COLUMN `targetSite` VARCHAR(191) NULL;
ALTER TABLE `Article` ADD COLUMN `publishMeta` LONGTEXT NULL;
