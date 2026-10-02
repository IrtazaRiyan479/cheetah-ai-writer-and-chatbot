ALTER TABLE `FeatureFlag` ADD COLUMN `mode` VARCHAR(191) NOT NULL DEFAULT 'pro';
ALTER TABLE `User` ADD COLUMN `wordsLimitCustomized` BOOLEAN NOT NULL DEFAULT false;
UPDATE `FeatureFlag` SET `mode` = CASE WHEN `enabled` = 0 THEN 'off' WHEN `free` = 1 THEN 'free' ELSE 'pro' END;

CREATE TABLE `AppSetting` (
  `key` VARCHAR(191) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
