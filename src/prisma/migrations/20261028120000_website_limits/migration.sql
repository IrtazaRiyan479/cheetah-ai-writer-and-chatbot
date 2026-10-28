-- Per-plan website caps. Max and admin stay unlimited in application code.
-- Word generation stays on wordsLimit / wordsUsed. This does not add an article counter.

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'User' AND COLUMN_NAME = 'websiteLimit'
    ),
    'SELECT 1',
    'ALTER TABLE `User` ADD COLUMN `websiteLimit` INTEGER NOT NULL DEFAULT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'User' AND COLUMN_NAME = 'websiteLimitCustomized'
    ),
    'SELECT 1',
    'ALTER TABLE `User` ADD COLUMN `websiteLimitCustomized` BOOLEAN NOT NULL DEFAULT false'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
