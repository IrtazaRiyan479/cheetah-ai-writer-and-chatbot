ALTER TABLE `FeatureFlag` ADD COLUMN `usePaidKeys` BOOLEAN NOT NULL DEFAULT false;

-- Match the previous rule: Pro/Max features used paid keys unless the global free-key switch was on.
UPDATE `FeatureFlag`
SET `usePaidKeys` = true
WHERE `mode` IN ('pro', 'max') AND `enabled` = true;

UPDATE `FeatureFlag`
SET `usePaidKeys` = false
WHERE EXISTS (
  SELECT 1 FROM `AppSetting`
  WHERE `key` = 'allowFreeGeminiKeysForPro' AND `value` IN ('1', 'true')
);
