-- Update MWFC judge user records with first/last names
UPDATE user SET firstName = 'Marcus', lastName = 'Thompson' WHERE id = 'usr_mwfc_judge_01';
UPDATE user SET firstName = 'Jennifer', lastName = 'Santos' WHERE id = 'usr_mwfc_judge_02';
UPDATE user SET firstName = 'Robert', lastName = 'Chen' WHERE id = 'usr_mwfc_judge_03';
UPDATE user SET firstName = 'Sarah', lastName = 'Johnson' WHERE id = 'usr_mwfc_judge_04';
UPDATE user SET firstName = 'Mike', lastName = 'Williams' WHERE id = 'usr_mwfc_judge_05';
UPDATE user SET firstName = 'Emily', lastName = 'Davis' WHERE id = 'usr_mwfc_judge_06';
UPDATE user SET firstName = 'Chris', lastName = 'Anderson' WHERE id = 'usr_mwfc_judge_07';
UPDATE user SET firstName = 'Jessica', lastName = 'Martinez' WHERE id = 'usr_mwfc_judge_08';
UPDATE user SET firstName = 'David', lastName = 'Taylor' WHERE id = 'usr_mwfc_judge_09';
UPDATE user SET firstName = 'Amanda', lastName = 'Thomas' WHERE id = 'usr_mwfc_judge_10';
UPDATE user SET firstName = 'Brian', lastName = 'Jackson' WHERE id = 'usr_mwfc_judge_11';
UPDATE user SET firstName = 'Megan', lastName = 'White' WHERE id = 'usr_mwfc_judge_12';
UPDATE user SET firstName = 'Kevin', lastName = 'Harris' WHERE id = 'usr_mwfc_judge_13';
UPDATE user SET firstName = 'Lauren', lastName = 'Clark' WHERE id = 'usr_mwfc_judge_14';
UPDATE user SET firstName = 'Jason', lastName = 'Lewis' WHERE id = 'usr_mwfc_judge_15';
UPDATE user SET firstName = 'Ashley', lastName = 'Robinson' WHERE id = 'usr_mwfc_judge_16';
UPDATE user SET firstName = 'Ryan', lastName = 'Walker' WHERE id = 'usr_mwfc_judge_17';
UPDATE user SET firstName = 'Nicole', lastName = 'Hall' WHERE id = 'usr_mwfc_judge_18';
UPDATE user SET firstName = 'Tyler', lastName = 'Allen' WHERE id = 'usr_mwfc_judge_19';
UPDATE user SET firstName = 'Stephanie', lastName = 'Young' WHERE id = 'usr_mwfc_judge_20';
UPDATE user SET firstName = 'Josh', lastName = 'Hernandez' WHERE id = 'usr_mwfc_judge_21';
UPDATE user SET firstName = 'Rachel', lastName = 'King' WHERE id = 'usr_mwfc_judge_22';
UPDATE user SET firstName = 'Daniel', lastName = 'Wright' WHERE id = 'usr_mwfc_judge_23';

-- Verify
SELECT id, firstName, lastName FROM user WHERE id LIKE 'usr_mwfc_judge_%';
