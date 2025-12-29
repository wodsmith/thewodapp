-- MWFC 2025 Demo Judges Seed Data
-- Creates 23 demo volunteer judges for competition comp_mwfc2025
--
-- Usage:
--   Production: wrangler d1 execute wodsmith-db --remote --file=./scripts/seed-mwfc-judges.sql
--   Local:      wrangler d1 execute wodsmith-db --local --file=./scripts/seed-mwfc-judges.sql
--
-- All emails are obviously fake to distinguish demo data from real signups
-- Creates both user records and team_membership records so judges appear in scheduling

-- Clean up any existing demo judges first (idempotent)
DELETE FROM team_membership 
WHERE teamId = (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025')
  AND userId IN (SELECT id FROM user WHERE email LIKE '%@fake-judges.test' OR email LIKE '%@not-a-real-email.invalid' OR email LIKE '%@demo-volunteer.fake');

DELETE FROM user 
WHERE email LIKE '%@fake-judges.test' 
   OR email LIKE '%@not-a-real-email.invalid' 
   OR email LIKE '%@demo-volunteer.fake';

-- Also clean up old invitation-based approach
DELETE FROM team_invitation 
WHERE teamId = (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025')
  AND (email LIKE '%fake-judges.test%'
       OR email LIKE '%not-a-real-email.invalid%'
       OR email LIKE '%demo-volunteer.fake%');

-- Create 23 demo judge users and their volunteer memberships
-- Judge 1: Marcus Thompson
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_01', 'totally.not.real.1@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_01', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_01', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Marcus Thompson"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 2: Jennifer Santos
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_02', 'definitely.fake.2@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_02', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_02', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Jennifer Santos"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 3: Robert Chen
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_03', 'this.is.fake.3@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_03', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_03', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Robert Chen"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 4: Sarah Johnson
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_04', 'sarah.johnson.4@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_04', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_04', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Sarah Johnson"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 5: Mike Williams
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_05', 'mike.williams.5@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_05', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_05', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Mike Williams"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 6: Emily Davis
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_06', 'emily.davis.6@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_06', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_06', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Emily Davis"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 7: Chris Anderson
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_07', 'chris.anderson.7@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_07', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_07', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Chris Anderson"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 8: Jessica Martinez
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_08', 'jessica.martinez.8@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_08', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_08', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Jessica Martinez"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 9: David Taylor
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_09', 'david.taylor.9@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_09', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_09', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"David Taylor"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 10: Amanda Thomas
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_10', 'amanda.thomas.10@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_10', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_10', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Amanda Thomas"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 11: Brian Jackson
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_11', 'brian.jackson.11@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_11', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_11', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Brian Jackson"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 12: Megan White
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_12', 'megan.white.12@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_12', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_12', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Megan White"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 13: Kevin Harris
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_13', 'kevin.harris.13@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_13', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_13', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Kevin Harris"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 14: Lauren Clark
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_14', 'lauren.clark.14@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_14', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_14', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Lauren Clark"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 15: Jason Lewis
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_15', 'jason.lewis.15@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_15', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_15', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Jason Lewis"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 16: Ashley Robinson
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_16', 'ashley.robinson.16@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_16', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_16', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Ashley Robinson"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 17: Ryan Walker
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_17', 'ryan.walker.17@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_17', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_17', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Ryan Walker"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 18: Nicole Hall
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_18', 'nicole.hall.18@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_18', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_18', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Nicole Hall"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 19: Tyler Allen
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_19', 'tyler.allen.19@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_19', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_19', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Tyler Allen"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 20: Stephanie Young
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_20', 'stephanie.young.20@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_20', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_20', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Stephanie Young"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 21: Josh Hernandez
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_21', 'josh.hernandez.21@demo-volunteer.fake', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_21', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_21', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Josh Hernandez"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 22: Rachel King
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_22', 'rachel.king.22@fake-judges.test', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_22', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_22', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Rachel King"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Judge 23: Daniel Wright
INSERT INTO user (id, email, createdAt, updatedAt, updateCounter) 
VALUES ('usr_mwfc_judge_23', 'daniel.wright.23@not-a-real-email.invalid', strftime('%s', 'now'), strftime('%s', 'now'), 0);
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, invitedAt, joinedAt, isActive, metadata, createdAt, updatedAt, updateCounter)
VALUES ('tmem_mwfc_judge_23', (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025'), 'usr_mwfc_judge_23', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, '{"volunteerRoleTypes":["judge"],"availability":"all_day","status":"approved","inviteSource":"direct","signupName":"Daniel Wright"}', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Verify the insertion
SELECT COUNT(*) as judge_count FROM team_membership 
WHERE teamId = (SELECT competitionTeamId FROM competitions WHERE id = 'comp_mwfc2025')
  AND roleId = 'volunteer'
  AND isSystemRole = 1
  AND id LIKE 'tmem_mwfc_judge_%';
