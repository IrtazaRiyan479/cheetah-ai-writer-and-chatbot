-- Add Article columns used by the publishing calendar when missing (MySQL).

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Article' AND COLUMN_NAME = 'outline'
    ),
    'SELECT 1',
    'ALTER TABLE `Article` ADD COLUMN `outline` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Article' AND COLUMN_NAME = 'wpPostId'
    ),
    'SELECT 1',
    'ALTER TABLE `Article` ADD COLUMN `wpPostId` INTEGER NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Article' AND COLUMN_NAME = 'targetSite'
    ),
    'SELECT 1',
    'ALTER TABLE `Article` ADD COLUMN `targetSite` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Article' AND COLUMN_NAME = 'scheduledAt'
    ),
    'SELECT 1',
    'ALTER TABLE `Article` ADD COLUMN `scheduledAt` DATETIME(3) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Article' AND COLUMN_NAME = 'publishMeta'
    ),
    'SELECT 1',
    'ALTER TABLE `Article` ADD COLUMN `publishMeta` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
