-- Add passPlatformFeesToCustomer column to competitions (default: true for new competitions)
ALTER TABLE `competitions` ADD `passPlatformFeesToCustomer` integer DEFAULT true;
