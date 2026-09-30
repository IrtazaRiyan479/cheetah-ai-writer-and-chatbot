-- AlterTable
ALTER TABLE `User`
  ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'free',
  ADD COLUMN `plan` VARCHAR(191) NOT NULL DEFAULT 'free',
  ADD COLUMN `subscriptionStatus` VARCHAR(191) NOT NULL DEFAULT 'none',
  ADD COLUMN `stripeCustomerId` VARCHAR(191) NULL,
  ADD COLUMN `stripeSubscriptionId` VARCHAR(191) NULL,
  ADD COLUMN `wordsUsed` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `wordsLimit` INTEGER NOT NULL DEFAULT 5000;

-- CreateTable
CREATE TABLE `FeatureFlag` (
  `key` VARCHAR(191) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `free` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`key`)
);

-- Preserve the existing demo admin. Do not downgrade other rows.
UPDATE `User` SET `role` = 'admin', `plan` = 'admin' WHERE `email` = 'admin@AffiGenie.com';

INSERT INTO `FeatureFlag` (`key`, `enabled`, `free`) VALUES
  ('standard', true, true),
  ('rewrite', true, true),
  ('amazon-roundup', true, false),
  ('amazon-review', true, false),
  ('amazon-roundup-rewrite', true, false),
  ('amazon-review-rewrite', true, false),
  ('listicle', true, false),
  ('local-roundup', true, false),
  ('youtube-blog', true, false),
  ('product-comparison', true, false),
  ('wp-publish', true, false),
  ('image-standalone', true, false),
  ('batch-generate', true, false);
