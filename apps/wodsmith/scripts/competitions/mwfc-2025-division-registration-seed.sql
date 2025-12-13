-- ============================================
-- MWFC 2025 Division Registrations Seed
-- Auto-generated from Competition Corner API
-- $350 per team registration = 35000 cents
-- ============================================
-- Generated: 2025-12-04T04:39:48.594Z
-- API: https://competitioncorner.net/api2/v1/schedule/workout/{workoutId}
--
-- Fee breakdown: $350 total
-- - Platform fee (2.5%): $8.75 = 875 cents
-- - Stripe fee (2.9% + $0.30): ~$10.45 = 1045 cents
-- - Organizer net: $330.80 = 33080 cents


-- ============================================
-- CO-ED - RX
-- Division ID: slvl_mwfc_coed_rx (Competition Corner: 101884)
-- 13 teams
-- ============================================

-- Users for Co-Ed - RX
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_crx_verdantside_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Maddy', 'Fredrick', 'verdantside.1@example.com', '', 1),
  ('user_crx_verdantside_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Beau', 'Ancien', 'verdantside.2@example.com', '', 1),
  ('user_crx_96-chicago-bulls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jt', 'Mahon', '96-chicago-bulls.1@example.com', '', 1),
  ('user_crx_96-chicago-bulls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lena', 'Mentyka', '96-chicago-bulls.2@example.com', '', 1),
  ('user_crx_ag-fan-club_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ren', 'Li', 'ag-fan-club.1@example.com', '', 1),
  ('user_crx_ag-fan-club_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kay', 'Gray', 'ag-fan-club.2@example.com', '', 1),
  ('user_crx_daddy-with-a-phatty_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jarred', 'Melcher', 'daddy-with-a-phatty.1@example.com', '', 1),
  ('user_crx_daddy-with-a-phatty_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Victoria', 'Hayles', 'daddy-with-a-phatty.2@example.com', '', 1),
  ('user_crx_em-and-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Matthew', 'Burnham', 'em-and-m.1@example.com', '', 1),
  ('user_crx_em-and-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Emily', 'White', 'em-and-m.2@example.com', '', 1),
  ('user_crx_gcs-3_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Reagan', 'Moss', 'gcs-3.1@example.com', '', 1),
  ('user_crx_gcs-3_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'les', 'Dalrymple', 'gcs-3.2@example.com', '', 1),
  ('user_crx_goofy-goobers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Richelle', 'Hudson', 'goofy-goobers.1@example.com', '', 1),
  ('user_crx_goofy-goobers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kaysen', 'Perry', 'goofy-goobers.2@example.com', '', 1),
  ('user_crx_mules-of-co-pain_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cullen', 'Bland', 'mules-of-co-pain.1@example.com', '', 1),
  ('user_crx_mules-of-co-pain_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hannah', 'Frakes', 'mules-of-co-pain.2@example.com', '', 1),
  ('user_crx_queen-and-jerk_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Adrienne', 'Gulley', 'queen-and-jerk.1@example.com', '', 1),
  ('user_crx_queen-and-jerk_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Shane', 'Estrada', 'queen-and-jerk.2@example.com', '', 1),
  ('user_crx_rodeo-rhymers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Haley', 'Trap', 'rodeo-rhymers.1@example.com', '', 1),
  ('user_crx_rodeo-rhymers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Donald', 'Pollitt', 'rodeo-rhymers.2@example.com', '', 1),
  ('user_crx_team-day-ones_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Brooklynn', 'Sittner', 'team-day-ones.1@example.com', '', 1),
  ('user_crx_team-day-ones_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Malachi', 'Bennett', 'team-day-ones.2@example.com', '', 1),
  ('user_crx_trident-athletics_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Petar', 'Arbov', 'trident-athletics.1@example.com', '', 1),
  ('user_crx_trident-athletics_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Phebe', 'Markley', 'trident-athletics.2@example.com', '', 1),
  ('user_crx_two-toned-thunder_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Zoe', 'Burns', 'two-toned-thunder.1@example.com', '', 1),
  ('user_crx_two-toned-thunder_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Alan', 'Giron', 'two-toned-thunder.2@example.com', '', 1);

-- Athlete Teams for Co-Ed - RX
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_crx_verdantside', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Verdantside', 'verdantside', 'athlete', NULL),
  ('team_crx_96-chicago-bulls', strftime('%s', 'now'), strftime('%s', 'now'), 1, '‘96 Chicago Bulls', '96-chicago-bulls', 'athlete', NULL),
  ('team_crx_ag-fan-club', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'AG Fan Club', 'ag-fan-club', 'athlete', NULL),
  ('team_crx_daddy-with-a-phatty', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Daddy with a Phatty', 'daddy-with-a-phatty', 'athlete', NULL),
  ('team_crx_em-and-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Em and M', 'em-and-m', 'athlete', NULL),
  ('team_crx_gcs-3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'GCS 3', 'gcs-3', 'athlete', NULL),
  ('team_crx_goofy-goobers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Goofy Goobers', 'goofy-goobers', 'athlete', NULL),
  ('team_crx_mules-of-co-pain', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mules of Co-Pain', 'mules-of-co-pain', 'athlete', NULL),
  ('team_crx_queen-and-jerk', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Queen and Jerk', 'queen-and-jerk', 'athlete', NULL),
  ('team_crx_rodeo-rhymers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rodeo Rhymers', 'rodeo-rhymers', 'athlete', NULL),
  ('team_crx_team-day-ones', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'TEAM DAY ONES', 'team-day-ones', 'athlete', NULL),
  ('team_crx_trident-athletics', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Trident Athletics', 'trident-athletics', 'athlete', NULL),
  ('team_crx_two-toned-thunder', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Two Toned Thunder', 'two-toned-thunder', 'athlete', NULL);

-- Team Memberships for Co-Ed - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_crx_verdantside_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_verdantside', 'user_crx_verdantside_1', 'admin', 1),
  ('tm_crx_verdantside_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_verdantside', 'user_crx_verdantside_2', 'member', 1),
  ('tm_crx_96-chicago-bulls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_96-chicago-bulls', 'user_crx_96-chicago-bulls_1', 'admin', 1),
  ('tm_crx_96-chicago-bulls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_96-chicago-bulls', 'user_crx_96-chicago-bulls_2', 'member', 1),
  ('tm_crx_ag-fan-club_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_ag-fan-club', 'user_crx_ag-fan-club_1', 'admin', 1),
  ('tm_crx_ag-fan-club_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_ag-fan-club', 'user_crx_ag-fan-club_2', 'member', 1),
  ('tm_crx_daddy-with-a-phatty_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_daddy-with-a-phatty', 'user_crx_daddy-with-a-phatty_1', 'admin', 1),
  ('tm_crx_daddy-with-a-phatty_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_daddy-with-a-phatty', 'user_crx_daddy-with-a-phatty_2', 'member', 1),
  ('tm_crx_em-and-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_em-and-m', 'user_crx_em-and-m_1', 'admin', 1),
  ('tm_crx_em-and-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_em-and-m', 'user_crx_em-and-m_2', 'member', 1),
  ('tm_crx_gcs-3_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_gcs-3', 'user_crx_gcs-3_1', 'admin', 1),
  ('tm_crx_gcs-3_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_gcs-3', 'user_crx_gcs-3_2', 'member', 1),
  ('tm_crx_goofy-goobers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_goofy-goobers', 'user_crx_goofy-goobers_1', 'admin', 1),
  ('tm_crx_goofy-goobers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_goofy-goobers', 'user_crx_goofy-goobers_2', 'member', 1),
  ('tm_crx_mules-of-co-pain_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_mules-of-co-pain', 'user_crx_mules-of-co-pain_1', 'admin', 1),
  ('tm_crx_mules-of-co-pain_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_mules-of-co-pain', 'user_crx_mules-of-co-pain_2', 'member', 1),
  ('tm_crx_queen-and-jerk_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_queen-and-jerk', 'user_crx_queen-and-jerk_1', 'admin', 1),
  ('tm_crx_queen-and-jerk_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_queen-and-jerk', 'user_crx_queen-and-jerk_2', 'member', 1),
  ('tm_crx_rodeo-rhymers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_rodeo-rhymers', 'user_crx_rodeo-rhymers_1', 'admin', 1),
  ('tm_crx_rodeo-rhymers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_rodeo-rhymers', 'user_crx_rodeo-rhymers_2', 'member', 1),
  ('tm_crx_team-day-ones_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_team-day-ones', 'user_crx_team-day-ones_1', 'admin', 1),
  ('tm_crx_team-day-ones_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_team-day-ones', 'user_crx_team-day-ones_2', 'member', 1),
  ('tm_crx_trident-athletics_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_trident-athletics', 'user_crx_trident-athletics_1', 'admin', 1),
  ('tm_crx_trident-athletics_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_trident-athletics', 'user_crx_trident-athletics_2', 'member', 1),
  ('tm_crx_two-toned-thunder_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_two-toned-thunder', 'user_crx_two-toned-thunder_1', 'admin', 1),
  ('tm_crx_two-toned-thunder_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crx_two-toned-thunder', 'user_crx_two-toned-thunder_2', 'member', 1);

-- Event Team Memberships for Co-Ed - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_crx_verdantside_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_verdantside_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_verdantside_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_verdantside_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_96-chicago-bulls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_96-chicago-bulls_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_96-chicago-bulls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_96-chicago-bulls_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_ag-fan-club_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_ag-fan-club_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_ag-fan-club_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_ag-fan-club_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_daddy-with-a-phatty_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_daddy-with-a-phatty_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_daddy-with-a-phatty_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_daddy-with-a-phatty_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_em-and-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_em-and-m_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_em-and-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_em-and-m_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_gcs-3_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_gcs-3_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_gcs-3_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_gcs-3_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_goofy-goobers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_goofy-goobers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_goofy-goobers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_goofy-goobers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_mules-of-co-pain_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_mules-of-co-pain_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_mules-of-co-pain_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_mules-of-co-pain_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_queen-and-jerk_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_queen-and-jerk_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_queen-and-jerk_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_queen-and-jerk_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_rodeo-rhymers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_rodeo-rhymers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_rodeo-rhymers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_rodeo-rhymers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_team-day-ones_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_team-day-ones_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_team-day-ones_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_team-day-ones_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_trident-athletics_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_trident-athletics_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_trident-athletics_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_trident-athletics_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_two-toned-thunder_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_two-toned-thunder_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crx_two-toned-thunder_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crx_two-toned-thunder_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Co-Ed - RX ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_crx_verdantside', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_verdantside_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_96-chicago-bulls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_96-chicago-bulls_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_ag-fan-club', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_ag-fan-club_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_daddy-with-a-phatty', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_daddy-with-a-phatty_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_em-and-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_em-and-m_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_gcs-3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_gcs-3_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_goofy-goobers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_goofy-goobers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_mules-of-co-pain', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_mules-of-co-pain_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_queen-and-jerk', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_queen-and-jerk_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_rodeo-rhymers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_rodeo-rhymers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_team-day-ones', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_team-day-ones_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_trident-athletics', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_trident-athletics_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crx_two-toned-thunder', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crx_two-toned-thunder_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Co-Ed - RX
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_crx_verdantside', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_verdantside_1', 'tmem_evt_crx_verdantside_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Verdantside', 'user_crx_verdantside_1', 'team_crx_verdantside', 'cpur_crx_verdantside', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_96-chicago-bulls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_96-chicago-bulls_1', 'tmem_evt_crx_96-chicago-bulls_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), '‘96 Chicago Bulls', 'user_crx_96-chicago-bulls_1', 'team_crx_96-chicago-bulls', 'cpur_crx_96-chicago-bulls', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_ag-fan-club', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_ag-fan-club_1', 'tmem_evt_crx_ag-fan-club_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'AG Fan Club', 'user_crx_ag-fan-club_1', 'team_crx_ag-fan-club', 'cpur_crx_ag-fan-club', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_daddy-with-a-phatty', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_daddy-with-a-phatty_1', 'tmem_evt_crx_daddy-with-a-phatty_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Daddy with a Phatty', 'user_crx_daddy-with-a-phatty_1', 'team_crx_daddy-with-a-phatty', 'cpur_crx_daddy-with-a-phatty', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_em-and-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_em-and-m_1', 'tmem_evt_crx_em-and-m_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Em and M', 'user_crx_em-and-m_1', 'team_crx_em-and-m', 'cpur_crx_em-and-m', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_gcs-3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_gcs-3_1', 'tmem_evt_crx_gcs-3_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'GCS 3', 'user_crx_gcs-3_1', 'team_crx_gcs-3', 'cpur_crx_gcs-3', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_goofy-goobers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_goofy-goobers_1', 'tmem_evt_crx_goofy-goobers_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Goofy Goobers', 'user_crx_goofy-goobers_1', 'team_crx_goofy-goobers', 'cpur_crx_goofy-goobers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_mules-of-co-pain', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_mules-of-co-pain_1', 'tmem_evt_crx_mules-of-co-pain_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Mules of Co-Pain', 'user_crx_mules-of-co-pain_1', 'team_crx_mules-of-co-pain', 'cpur_crx_mules-of-co-pain', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_queen-and-jerk', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_queen-and-jerk_1', 'tmem_evt_crx_queen-and-jerk_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Queen and Jerk', 'user_crx_queen-and-jerk_1', 'team_crx_queen-and-jerk', 'cpur_crx_queen-and-jerk', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_rodeo-rhymers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_rodeo-rhymers_1', 'tmem_evt_crx_rodeo-rhymers_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Rodeo Rhymers', 'user_crx_rodeo-rhymers_1', 'team_crx_rodeo-rhymers', 'cpur_crx_rodeo-rhymers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_team-day-ones', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_team-day-ones_1', 'tmem_evt_crx_team-day-ones_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'TEAM DAY ONES', 'user_crx_team-day-ones_1', 'team_crx_team-day-ones', 'cpur_crx_team-day-ones', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_trident-athletics', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_trident-athletics_1', 'tmem_evt_crx_trident-athletics_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Trident Athletics', 'user_crx_trident-athletics_1', 'team_crx_trident-athletics', 'cpur_crx_trident-athletics', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crx_two-toned-thunder', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crx_two-toned-thunder_1', 'tmem_evt_crx_two-toned-thunder_1', 'slvl_mwfc_coed_rx', strftime('%s', '2025-08-01'), 'Two Toned Thunder', 'user_crx_two-toned-thunder_1', 'team_crx_two-toned-thunder', 'cpur_crx_two-toned-thunder', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- CO-ED - INTERMEDIATE
-- Division ID: slvl_mwfc_coed_int (Competition Corner: 104732)
-- 19 teams
-- ============================================

-- Users for Co-Ed - Intermediate
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_cint_battle-born-and-worn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nicole', 'Ward', 'battle-born-and-worn.1@example.com', '', 1),
  ('user_cint_battle-born-and-worn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'MITCHELL', 'DOHENY', 'battle-born-and-worn.2@example.com', '', 1),
  ('user_cint_beat-boxers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chris', 'Kaufman', 'beat-boxers.1@example.com', '', 1),
  ('user_cint_beat-boxers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Shelby', 'Hildebrandt', 'beat-boxers.2@example.com', '', 1),
  ('user_cint_bubba-needs-help_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rachel', 'Meighan', 'bubba-needs-help.1@example.com', '', 1),
  ('user_cint_bubba-needs-help_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Isaac', 'Eads', 'bubba-needs-help.2@example.com', '', 1),
  ('user_cint_cam-and-kenn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Makenna', 'Ridenour', 'cam-and-kenn.1@example.com', '', 1),
  ('user_cint_cam-and-kenn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Camren', 'Mccollum', 'cam-and-kenn.2@example.com', '', 1),
  ('user_cint_deadlifts-chill_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Maddie', 'Clifford', 'deadlifts-chill.1@example.com', '', 1),
  ('user_cint_deadlifts-chill_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ryan', 'Bradshaw', 'deadlifts-chill.2@example.com', '', 1),
  ('user_cint_dnr_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Riley', 'Anderson', 'dnr.1@example.com', '', 1),
  ('user_cint_dnr_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Daniel', 'Holst', 'dnr.2@example.com', '', 1),
  ('user_cint_dos-chanchos_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dre', 'Lucich', 'dos-chanchos.1@example.com', '', 1),
  ('user_cint_dos-chanchos_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Austin', 'Weakley', 'dos-chanchos.2@example.com', '', 1),
  ('user_cint_grass-fed-grass-fini_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Gianni', 'Coraci', 'grass-fed-grass-fini.1@example.com', '', 1),
  ('user_cint_grass-fed-grass-fini_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sophia', 'Katz', 'grass-fed-grass-fini.2@example.com', '', 1),
  ('user_cint_hustle-and-muscle_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Alyssa', 'Smith', 'hustle-and-muscle.1@example.com', '', 1),
  ('user_cint_hustle-and-muscle_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Will', 'Smith', 'hustle-and-muscle.2@example.com', '', 1),
  ('user_cint_misery-loves-company_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Marisa', 'Mullen', 'misery-loves-company.1@example.com', '', 1),
  ('user_cint_misery-loves-company_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dillon', 'Dotson', 'misery-loves-company.2@example.com', '', 1),
  ('user_cint_no-rep-no-whey_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Desirae', 'Lyall', 'no-rep-no-whey.1@example.com', '', 1),
  ('user_cint_no-rep-no-whey_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lorenzo', 'Isiordia', 'no-rep-no-whey.2@example.com', '', 1),
  ('user_cint_row-mates-for-life_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Emma', 'Gaona', 'row-mates-for-life.1@example.com', '', 1),
  ('user_cint_row-mates-for-life_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kory', 'Gaona', 'row-mates-for-life.2@example.com', '', 1),
  ('user_cint_swole-in-spirit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cody', 'Quinn', 'swole-in-spirit.1@example.com', '', 1),
  ('user_cint_swole-in-spirit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sara', 'Durfee', 'swole-in-spirit.2@example.com', '', 1),
  ('user_cint_swolemates_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Andrea', 'Medlin', 'swolemates.1@example.com', '', 1),
  ('user_cint_swolemates_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'KYLIE', ' MEDLIN', 'swolemates.2@example.com', '', 1),
  ('user_cint_the-frenchies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Matthieu', 'Colin', 'the-frenchies.1@example.com', '', 1),
  ('user_cint_the-frenchies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Marina', 'Betbeder', 'the-frenchies.2@example.com', '', 1),
  ('user_cint_thicc-and-tired_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kristin', 'Russell', 'thicc-and-tired.1@example.com', '', 1),
  ('user_cint_thicc-and-tired_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Heath', 'Owens', 'thicc-and-tired.2@example.com', '', 1),
  ('user_cint_untaymable_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Taylor', 'Brown', 'untaymable.1@example.com', '', 1),
  ('user_cint_untaymable_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Taylor', 'Duke', 'untaymable.2@example.com', '', 1),
  ('user_cint_what-would-froning-d_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nic', 'Jayo', 'what-would-froning-d.1@example.com', '', 1),
  ('user_cint_what-would-froning-d_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jen', 'Abouzeid', 'what-would-froning-d.2@example.com', '', 1),
  ('user_cint_wod-my-name-out-yo-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jorge', 'Sandoval', 'wod-my-name-out-yo-m.1@example.com', '', 1),
  ('user_cint_wod-my-name-out-yo-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Karisma', 'Rapp', 'wod-my-name-out-yo-m.2@example.com', '', 1);

-- Athlete Teams for Co-Ed - Intermediate
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_cint_battle-born-and-worn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Battle Born and Worn', 'battle-born-and-worn', 'athlete', NULL),
  ('team_cint_beat-boxers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Beat Boxers', 'beat-boxers', 'athlete', NULL),
  ('team_cint_bubba-needs-help', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bubba Needs Help', 'bubba-needs-help', 'athlete', NULL),
  ('team_cint_cam-and-kenn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cam and Kenn', 'cam-and-kenn', 'athlete', NULL),
  ('team_cint_deadlifts-chill', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Deadlifts & Chill', 'deadlifts-chill', 'athlete', NULL),
  ('team_cint_dnr', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'DNR', 'dnr', 'athlete', NULL),
  ('team_cint_dos-chanchos', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dos Chanchos', 'dos-chanchos', 'athlete', NULL),
  ('team_cint_grass-fed-grass-fini', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Grass Fed Grass Finished', 'grass-fed-grass-fini', 'athlete', NULL),
  ('team_cint_hustle-and-muscle', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hustle and Muscle', 'hustle-and-muscle', 'athlete', NULL),
  ('team_cint_misery-loves-company', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Misery Loves Company', 'misery-loves-company', 'athlete', NULL),
  ('team_cint_no-rep-no-whey', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'No Rep? No whey!', 'no-rep-no-whey', 'athlete', NULL),
  ('team_cint_row-mates-for-life', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Row-mates for Life', 'row-mates-for-life', 'athlete', NULL),
  ('team_cint_swole-in-spirit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Swole in Spirit', 'swole-in-spirit', 'athlete', NULL),
  ('team_cint_swolemates', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'SWOLEMATES', 'swolemates', 'athlete', NULL),
  ('team_cint_the-frenchies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Frenchies', 'the-frenchies', 'athlete', NULL),
  ('team_cint_thicc-and-tired', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Thicc and Tired', 'thicc-and-tired', 'athlete', NULL),
  ('team_cint_untaymable', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'unTAYmable', 'untaymable', 'athlete', NULL),
  ('team_cint_what-would-froning-d', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'What Would Froning Do?', 'what-would-froning-d', 'athlete', NULL),
  ('team_cint_wod-my-name-out-yo-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'WOD my name out yo mouth', 'wod-my-name-out-yo-m', 'athlete', NULL);

-- Team Memberships for Co-Ed - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_cint_battle-born-and-worn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_battle-born-and-worn', 'user_cint_battle-born-and-worn_1', 'admin', 1),
  ('tm_cint_battle-born-and-worn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_battle-born-and-worn', 'user_cint_battle-born-and-worn_2', 'member', 1),
  ('tm_cint_beat-boxers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_beat-boxers', 'user_cint_beat-boxers_1', 'admin', 1),
  ('tm_cint_beat-boxers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_beat-boxers', 'user_cint_beat-boxers_2', 'member', 1),
  ('tm_cint_bubba-needs-help_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_bubba-needs-help', 'user_cint_bubba-needs-help_1', 'admin', 1),
  ('tm_cint_bubba-needs-help_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_bubba-needs-help', 'user_cint_bubba-needs-help_2', 'member', 1),
  ('tm_cint_cam-and-kenn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_cam-and-kenn', 'user_cint_cam-and-kenn_1', 'admin', 1),
  ('tm_cint_cam-and-kenn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_cam-and-kenn', 'user_cint_cam-and-kenn_2', 'member', 1),
  ('tm_cint_deadlifts-chill_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_deadlifts-chill', 'user_cint_deadlifts-chill_1', 'admin', 1),
  ('tm_cint_deadlifts-chill_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_deadlifts-chill', 'user_cint_deadlifts-chill_2', 'member', 1),
  ('tm_cint_dnr_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_dnr', 'user_cint_dnr_1', 'admin', 1),
  ('tm_cint_dnr_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_dnr', 'user_cint_dnr_2', 'member', 1),
  ('tm_cint_dos-chanchos_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_dos-chanchos', 'user_cint_dos-chanchos_1', 'admin', 1),
  ('tm_cint_dos-chanchos_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_dos-chanchos', 'user_cint_dos-chanchos_2', 'member', 1),
  ('tm_cint_grass-fed-grass-fini_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_grass-fed-grass-fini', 'user_cint_grass-fed-grass-fini_1', 'admin', 1),
  ('tm_cint_grass-fed-grass-fini_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_grass-fed-grass-fini', 'user_cint_grass-fed-grass-fini_2', 'member', 1),
  ('tm_cint_hustle-and-muscle_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_hustle-and-muscle', 'user_cint_hustle-and-muscle_1', 'admin', 1),
  ('tm_cint_hustle-and-muscle_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_hustle-and-muscle', 'user_cint_hustle-and-muscle_2', 'member', 1),
  ('tm_cint_misery-loves-company_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_misery-loves-company', 'user_cint_misery-loves-company_1', 'admin', 1),
  ('tm_cint_misery-loves-company_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_misery-loves-company', 'user_cint_misery-loves-company_2', 'member', 1),
  ('tm_cint_no-rep-no-whey_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_no-rep-no-whey', 'user_cint_no-rep-no-whey_1', 'admin', 1),
  ('tm_cint_no-rep-no-whey_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_no-rep-no-whey', 'user_cint_no-rep-no-whey_2', 'member', 1),
  ('tm_cint_row-mates-for-life_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_row-mates-for-life', 'user_cint_row-mates-for-life_1', 'admin', 1),
  ('tm_cint_row-mates-for-life_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_row-mates-for-life', 'user_cint_row-mates-for-life_2', 'member', 1),
  ('tm_cint_swole-in-spirit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_swole-in-spirit', 'user_cint_swole-in-spirit_1', 'admin', 1),
  ('tm_cint_swole-in-spirit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_swole-in-spirit', 'user_cint_swole-in-spirit_2', 'member', 1),
  ('tm_cint_swolemates_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_swolemates', 'user_cint_swolemates_1', 'admin', 1),
  ('tm_cint_swolemates_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_swolemates', 'user_cint_swolemates_2', 'member', 1),
  ('tm_cint_the-frenchies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_the-frenchies', 'user_cint_the-frenchies_1', 'admin', 1),
  ('tm_cint_the-frenchies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_the-frenchies', 'user_cint_the-frenchies_2', 'member', 1),
  ('tm_cint_thicc-and-tired_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_thicc-and-tired', 'user_cint_thicc-and-tired_1', 'admin', 1),
  ('tm_cint_thicc-and-tired_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_thicc-and-tired', 'user_cint_thicc-and-tired_2', 'member', 1),
  ('tm_cint_untaymable_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_untaymable', 'user_cint_untaymable_1', 'admin', 1),
  ('tm_cint_untaymable_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_untaymable', 'user_cint_untaymable_2', 'member', 1),
  ('tm_cint_what-would-froning-d_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_what-would-froning-d', 'user_cint_what-would-froning-d_1', 'admin', 1),
  ('tm_cint_what-would-froning-d_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_what-would-froning-d', 'user_cint_what-would-froning-d_2', 'member', 1),
  ('tm_cint_wod-my-name-out-yo-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_wod-my-name-out-yo-m', 'user_cint_wod-my-name-out-yo-m_1', 'admin', 1),
  ('tm_cint_wod-my-name-out-yo-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_cint_wod-my-name-out-yo-m', 'user_cint_wod-my-name-out-yo-m_2', 'member', 1);

-- Event Team Memberships for Co-Ed - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_cint_battle-born-and-worn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_battle-born-and-worn_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_battle-born-and-worn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_battle-born-and-worn_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_beat-boxers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_beat-boxers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_beat-boxers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_beat-boxers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_bubba-needs-help_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_bubba-needs-help_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_bubba-needs-help_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_bubba-needs-help_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_cam-and-kenn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_cam-and-kenn_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_cam-and-kenn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_cam-and-kenn_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_deadlifts-chill_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_deadlifts-chill_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_deadlifts-chill_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_deadlifts-chill_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_dnr_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_dnr_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_dnr_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_dnr_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_dos-chanchos_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_dos-chanchos_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_dos-chanchos_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_dos-chanchos_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_grass-fed-grass-fini_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_grass-fed-grass-fini_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_grass-fed-grass-fini_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_grass-fed-grass-fini_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_hustle-and-muscle_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_hustle-and-muscle_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_hustle-and-muscle_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_hustle-and-muscle_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_misery-loves-company_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_misery-loves-company_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_misery-loves-company_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_misery-loves-company_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_no-rep-no-whey_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_no-rep-no-whey_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_no-rep-no-whey_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_no-rep-no-whey_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_row-mates-for-life_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_row-mates-for-life_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_row-mates-for-life_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_row-mates-for-life_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_swole-in-spirit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_swole-in-spirit_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_swole-in-spirit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_swole-in-spirit_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_swolemates_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_swolemates_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_swolemates_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_swolemates_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_the-frenchies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_the-frenchies_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_the-frenchies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_the-frenchies_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_thicc-and-tired_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_thicc-and-tired_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_thicc-and-tired_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_thicc-and-tired_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_untaymable_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_untaymable_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_untaymable_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_untaymable_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_what-would-froning-d_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_what-would-froning-d_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_what-would-froning-d_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_what-would-froning-d_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_wod-my-name-out-yo-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_wod-my-name-out-yo-m_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_cint_wod-my-name-out-yo-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_cint_wod-my-name-out-yo-m_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Co-Ed - Intermediate ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_cint_battle-born-and-worn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_battle-born-and-worn_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_beat-boxers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_beat-boxers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_bubba-needs-help', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_bubba-needs-help_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_cam-and-kenn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_cam-and-kenn_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_deadlifts-chill', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_deadlifts-chill_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_dnr', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_dnr_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_dos-chanchos', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_dos-chanchos_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_grass-fed-grass-fini', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_grass-fed-grass-fini_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_hustle-and-muscle', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_hustle-and-muscle_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_misery-loves-company', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_misery-loves-company_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_no-rep-no-whey', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_no-rep-no-whey_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_row-mates-for-life', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_row-mates-for-life_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_swole-in-spirit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_swole-in-spirit_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_swolemates', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_swolemates_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_the-frenchies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_the-frenchies_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_thicc-and-tired', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_thicc-and-tired_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_untaymable', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_untaymable_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_what-would-froning-d', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_what-would-froning-d_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_cint_wod-my-name-out-yo-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_cint_wod-my-name-out-yo-m_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Co-Ed - Intermediate
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_cint_battle-born-and-worn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_battle-born-and-worn_1', 'tmem_evt_cint_battle-born-and-worn_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Battle Born and Worn', 'user_cint_battle-born-and-worn_1', 'team_cint_battle-born-and-worn', 'cpur_cint_battle-born-and-worn', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_beat-boxers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_beat-boxers_1', 'tmem_evt_cint_beat-boxers_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Beat Boxers', 'user_cint_beat-boxers_1', 'team_cint_beat-boxers', 'cpur_cint_beat-boxers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_bubba-needs-help', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_bubba-needs-help_1', 'tmem_evt_cint_bubba-needs-help_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Bubba Needs Help', 'user_cint_bubba-needs-help_1', 'team_cint_bubba-needs-help', 'cpur_cint_bubba-needs-help', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_cam-and-kenn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_cam-and-kenn_1', 'tmem_evt_cint_cam-and-kenn_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Cam and Kenn', 'user_cint_cam-and-kenn_1', 'team_cint_cam-and-kenn', 'cpur_cint_cam-and-kenn', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_deadlifts-chill', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_deadlifts-chill_1', 'tmem_evt_cint_deadlifts-chill_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Deadlifts & Chill', 'user_cint_deadlifts-chill_1', 'team_cint_deadlifts-chill', 'cpur_cint_deadlifts-chill', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_dnr', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_dnr_1', 'tmem_evt_cint_dnr_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'DNR', 'user_cint_dnr_1', 'team_cint_dnr', 'cpur_cint_dnr', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_dos-chanchos', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_dos-chanchos_1', 'tmem_evt_cint_dos-chanchos_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Dos Chanchos', 'user_cint_dos-chanchos_1', 'team_cint_dos-chanchos', 'cpur_cint_dos-chanchos', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_grass-fed-grass-fini', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_grass-fed-grass-fini_1', 'tmem_evt_cint_grass-fed-grass-fini_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Grass Fed Grass Finished', 'user_cint_grass-fed-grass-fini_1', 'team_cint_grass-fed-grass-fini', 'cpur_cint_grass-fed-grass-fini', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_hustle-and-muscle', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_hustle-and-muscle_1', 'tmem_evt_cint_hustle-and-muscle_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Hustle and Muscle', 'user_cint_hustle-and-muscle_1', 'team_cint_hustle-and-muscle', 'cpur_cint_hustle-and-muscle', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_misery-loves-company', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_misery-loves-company_1', 'tmem_evt_cint_misery-loves-company_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Misery Loves Company', 'user_cint_misery-loves-company_1', 'team_cint_misery-loves-company', 'cpur_cint_misery-loves-company', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_no-rep-no-whey', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_no-rep-no-whey_1', 'tmem_evt_cint_no-rep-no-whey_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'No Rep? No whey!', 'user_cint_no-rep-no-whey_1', 'team_cint_no-rep-no-whey', 'cpur_cint_no-rep-no-whey', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_row-mates-for-life', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_row-mates-for-life_1', 'tmem_evt_cint_row-mates-for-life_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Row-mates for Life', 'user_cint_row-mates-for-life_1', 'team_cint_row-mates-for-life', 'cpur_cint_row-mates-for-life', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_swole-in-spirit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_swole-in-spirit_1', 'tmem_evt_cint_swole-in-spirit_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Swole in Spirit', 'user_cint_swole-in-spirit_1', 'team_cint_swole-in-spirit', 'cpur_cint_swole-in-spirit', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_swolemates', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_swolemates_1', 'tmem_evt_cint_swolemates_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'SWOLEMATES', 'user_cint_swolemates_1', 'team_cint_swolemates', 'cpur_cint_swolemates', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_the-frenchies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_the-frenchies_1', 'tmem_evt_cint_the-frenchies_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'The Frenchies', 'user_cint_the-frenchies_1', 'team_cint_the-frenchies', 'cpur_cint_the-frenchies', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_thicc-and-tired', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_thicc-and-tired_1', 'tmem_evt_cint_thicc-and-tired_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'Thicc and Tired', 'user_cint_thicc-and-tired_1', 'team_cint_thicc-and-tired', 'cpur_cint_thicc-and-tired', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_untaymable', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_untaymable_1', 'tmem_evt_cint_untaymable_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'unTAYmable', 'user_cint_untaymable_1', 'team_cint_untaymable', 'cpur_cint_untaymable', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_what-would-froning-d', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_what-would-froning-d_1', 'tmem_evt_cint_what-would-froning-d_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'What Would Froning Do?', 'user_cint_what-would-froning-d_1', 'team_cint_what-would-froning-d', 'cpur_cint_what-would-froning-d', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_cint_wod-my-name-out-yo-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_cint_wod-my-name-out-yo-m_1', 'tmem_evt_cint_wod-my-name-out-yo-m_1', 'slvl_mwfc_coed_int', strftime('%s', '2025-08-01'), 'WOD my name out yo mouth', 'user_cint_wod-my-name-out-yo-m_1', 'team_cint_wod-my-name-out-yo-m', 'cpur_cint_wod-my-name-out-yo-m', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- CO-ED - ROOKIE
-- Division ID: slvl_mwfc_coed_rookie (Competition Corner: 104733)
-- 10 teams
-- ============================================

-- Users for Co-Ed - Rookie
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_crook_breakfast-dinner_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sami', 'Reynolds', 'breakfast-dinner.1@example.com', '', 1),
  ('user_crook_breakfast-dinner_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jake', 'Reynolds', 'breakfast-dinner.2@example.com', '', 1),
  ('user_crook_cheez-it-extra-toast_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Masaki', 'Fujimoto', 'cheez-it-extra-toast.1@example.com', '', 1),
  ('user_crook_cheez-it-extra-toast_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bel', 'Phillipp', 'cheez-it-extra-toast.2@example.com', '', 1),
  ('user_crook_feel-the-mcburn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sadie', 'McBournie', 'feel-the-mcburn.1@example.com', '', 1),
  ('user_crook_feel-the-mcburn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Zach', 'Mcbournie', 'feel-the-mcburn.2@example.com', '', 1),
  ('user_crook_fitz-and-furious_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'John', 'Fitzgerald', 'fitz-and-furious.1@example.com', '', 1),
  ('user_crook_fitz-and-furious_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Delaney', 'Fitzgerald', 'fitz-and-furious.2@example.com', '', 1),
  ('user_crook_geweck-yourselves_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jessica', 'Gewecke', 'geweck-yourselves.1@example.com', '', 1),
  ('user_crook_geweck-yourselves_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Casey', 'Gewecke', 'geweck-yourselves.2@example.com', '', 1),
  ('user_crook_let-em-cook_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tanner', 'Cook', 'let-em-cook.1@example.com', '', 1),
  ('user_crook_let-em-cook_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Susanna', 'Cook', 'let-em-cook.2@example.com', '', 1),
  ('user_crook_richardson-rebels_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kandra', 'Richardson', 'richardson-rebels.1@example.com', '', 1),
  ('user_crook_richardson-rebels_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jon', 'Richardson', 'richardson-rebels.2@example.com', '', 1),
  ('user_crook_sin-miedo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Luz', 'Villagomez', 'sin-miedo.1@example.com', '', 1),
  ('user_crook_sin-miedo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jaime', 'Eudave', 'sin-miedo.2@example.com', '', 1),
  ('user_crook_sore-losers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jake', 'Burton', 'sore-losers.1@example.com', '', 1),
  ('user_crook_sore-losers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Katie', 'Burton', 'sore-losers.2@example.com', '', 1),
  ('user_crook_the-rex-factor_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mj', 'Brooks', 'the-rex-factor.1@example.com', '', 1),
  ('user_crook_the-rex-factor_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Reagan', 'Rex', 'the-rex-factor.2@example.com', '', 1);

-- Athlete Teams for Co-Ed - Rookie
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_crook_breakfast-dinner', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Breakfast Dinner', 'breakfast-dinner', 'athlete', NULL),
  ('team_crook_cheez-it-extra-toast', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cheez-It Extra Toasty', 'cheez-it-extra-toast', 'athlete', NULL),
  ('team_crook_feel-the-mcburn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Feel the McBurn', 'feel-the-mcburn', 'athlete', NULL),
  ('team_crook_fitz-and-furious', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Fitz and Furious', 'fitz-and-furious', 'athlete', NULL),
  ('team_crook_geweck-yourselves', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Geweck Yourselves', 'geweck-yourselves', 'athlete', NULL),
  ('team_crook_let-em-cook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Let ‘em Cook', 'let-em-cook', 'athlete', NULL),
  ('team_crook_richardson-rebels', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Richardson Rebels', 'richardson-rebels', 'athlete', NULL),
  ('team_crook_sin-miedo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sin Miedo', 'sin-miedo', 'athlete', NULL),
  ('team_crook_sore-losers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sore Losers', 'sore-losers', 'athlete', NULL),
  ('team_crook_the-rex-factor', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Rex Factor', 'the-rex-factor', 'athlete', NULL);

-- Team Memberships for Co-Ed - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_crook_breakfast-dinner_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_breakfast-dinner', 'user_crook_breakfast-dinner_1', 'admin', 1),
  ('tm_crook_breakfast-dinner_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_breakfast-dinner', 'user_crook_breakfast-dinner_2', 'member', 1),
  ('tm_crook_cheez-it-extra-toast_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_cheez-it-extra-toast', 'user_crook_cheez-it-extra-toast_1', 'admin', 1),
  ('tm_crook_cheez-it-extra-toast_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_cheez-it-extra-toast', 'user_crook_cheez-it-extra-toast_2', 'member', 1),
  ('tm_crook_feel-the-mcburn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_feel-the-mcburn', 'user_crook_feel-the-mcburn_1', 'admin', 1),
  ('tm_crook_feel-the-mcburn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_feel-the-mcburn', 'user_crook_feel-the-mcburn_2', 'member', 1),
  ('tm_crook_fitz-and-furious_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_fitz-and-furious', 'user_crook_fitz-and-furious_1', 'admin', 1),
  ('tm_crook_fitz-and-furious_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_fitz-and-furious', 'user_crook_fitz-and-furious_2', 'member', 1),
  ('tm_crook_geweck-yourselves_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_geweck-yourselves', 'user_crook_geweck-yourselves_1', 'admin', 1),
  ('tm_crook_geweck-yourselves_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_geweck-yourselves', 'user_crook_geweck-yourselves_2', 'member', 1),
  ('tm_crook_let-em-cook_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_let-em-cook', 'user_crook_let-em-cook_1', 'admin', 1),
  ('tm_crook_let-em-cook_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_let-em-cook', 'user_crook_let-em-cook_2', 'member', 1),
  ('tm_crook_richardson-rebels_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_richardson-rebels', 'user_crook_richardson-rebels_1', 'admin', 1),
  ('tm_crook_richardson-rebels_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_richardson-rebels', 'user_crook_richardson-rebels_2', 'member', 1),
  ('tm_crook_sin-miedo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_sin-miedo', 'user_crook_sin-miedo_1', 'admin', 1),
  ('tm_crook_sin-miedo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_sin-miedo', 'user_crook_sin-miedo_2', 'member', 1),
  ('tm_crook_sore-losers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_sore-losers', 'user_crook_sore-losers_1', 'admin', 1),
  ('tm_crook_sore-losers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_sore-losers', 'user_crook_sore-losers_2', 'member', 1),
  ('tm_crook_the-rex-factor_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_the-rex-factor', 'user_crook_the-rex-factor_1', 'admin', 1),
  ('tm_crook_the-rex-factor_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_crook_the-rex-factor', 'user_crook_the-rex-factor_2', 'member', 1);

-- Event Team Memberships for Co-Ed - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_crook_breakfast-dinner_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_breakfast-dinner_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_breakfast-dinner_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_breakfast-dinner_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_cheez-it-extra-toast_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_cheez-it-extra-toast_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_cheez-it-extra-toast_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_cheez-it-extra-toast_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_feel-the-mcburn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_feel-the-mcburn_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_feel-the-mcburn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_feel-the-mcburn_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_fitz-and-furious_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_fitz-and-furious_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_fitz-and-furious_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_fitz-and-furious_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_geweck-yourselves_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_geweck-yourselves_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_geweck-yourselves_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_geweck-yourselves_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_let-em-cook_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_let-em-cook_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_let-em-cook_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_let-em-cook_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_richardson-rebels_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_richardson-rebels_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_richardson-rebels_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_richardson-rebels_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_sin-miedo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_sin-miedo_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_sin-miedo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_sin-miedo_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_sore-losers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_sore-losers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_sore-losers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_sore-losers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_the-rex-factor_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_the-rex-factor_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_crook_the-rex-factor_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_crook_the-rex-factor_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Co-Ed - Rookie ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_crook_breakfast-dinner', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_breakfast-dinner_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_cheez-it-extra-toast', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_cheez-it-extra-toast_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_feel-the-mcburn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_feel-the-mcburn_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_fitz-and-furious', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_fitz-and-furious_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_geweck-yourselves', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_geweck-yourselves_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_let-em-cook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_let-em-cook_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_richardson-rebels', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_richardson-rebels_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_sin-miedo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_sin-miedo_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_sore-losers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_sore-losers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_crook_the-rex-factor', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_crook_the-rex-factor_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Co-Ed - Rookie
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_crook_breakfast-dinner', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_breakfast-dinner_1', 'tmem_evt_crook_breakfast-dinner_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Breakfast Dinner', 'user_crook_breakfast-dinner_1', 'team_crook_breakfast-dinner', 'cpur_crook_breakfast-dinner', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_cheez-it-extra-toast', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_cheez-it-extra-toast_1', 'tmem_evt_crook_cheez-it-extra-toast_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Cheez-It Extra Toasty', 'user_crook_cheez-it-extra-toast_1', 'team_crook_cheez-it-extra-toast', 'cpur_crook_cheez-it-extra-toast', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_feel-the-mcburn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_feel-the-mcburn_1', 'tmem_evt_crook_feel-the-mcburn_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Feel the McBurn', 'user_crook_feel-the-mcburn_1', 'team_crook_feel-the-mcburn', 'cpur_crook_feel-the-mcburn', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_fitz-and-furious', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_fitz-and-furious_1', 'tmem_evt_crook_fitz-and-furious_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Fitz and Furious', 'user_crook_fitz-and-furious_1', 'team_crook_fitz-and-furious', 'cpur_crook_fitz-and-furious', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_geweck-yourselves', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_geweck-yourselves_1', 'tmem_evt_crook_geweck-yourselves_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Geweck Yourselves', 'user_crook_geweck-yourselves_1', 'team_crook_geweck-yourselves', 'cpur_crook_geweck-yourselves', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_let-em-cook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_let-em-cook_1', 'tmem_evt_crook_let-em-cook_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Let ‘em Cook', 'user_crook_let-em-cook_1', 'team_crook_let-em-cook', 'cpur_crook_let-em-cook', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_richardson-rebels', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_richardson-rebels_1', 'tmem_evt_crook_richardson-rebels_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Richardson Rebels', 'user_crook_richardson-rebels_1', 'team_crook_richardson-rebels', 'cpur_crook_richardson-rebels', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_sin-miedo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_sin-miedo_1', 'tmem_evt_crook_sin-miedo_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Sin Miedo', 'user_crook_sin-miedo_1', 'team_crook_sin-miedo', 'cpur_crook_sin-miedo', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_sore-losers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_sore-losers_1', 'tmem_evt_crook_sore-losers_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'Sore Losers', 'user_crook_sore-losers_1', 'team_crook_sore-losers', 'cpur_crook_sore-losers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_crook_the-rex-factor', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_crook_the-rex-factor_1', 'tmem_evt_crook_the-rex-factor_1', 'slvl_mwfc_coed_rookie', strftime('%s', '2025-08-01'), 'The Rex Factor', 'user_crook_the-rex-factor_1', 'team_crook_the-rex-factor', 'cpur_crook_the-rex-factor', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- WOMEN'S - RX
-- Division ID: slvl_mwfc_womens_rx (Competition Corner: 104735)
-- 14 teams
-- ============================================

-- Users for Women's - RX
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_wrx_arbor-mcfit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Paige', 'Kolnes', 'arbor-mcfit.1@example.com', '', 1),
  ('user_wrx_arbor-mcfit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jessica', 'Coneff', 'arbor-mcfit.2@example.com', '', 1),
  ('user_wrx_hannah-montana_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hannah', 'Dodson', 'hannah-montana.1@example.com', '', 1),
  ('user_wrx_hannah-montana_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Montana', 'Powell', 'hannah-montana.2@example.com', '', 1),
  ('user_wrx_hot-mess-express_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jill', 'Zurcher', 'hot-mess-express.1@example.com', '', 1),
  ('user_wrx_hot-mess-express_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'SAMANTHA', 'Mosqueda', 'hot-mess-express.2@example.com', '', 1),
  ('user_wrx_jacked-in-the-box_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chelsea', 'Atkinson', 'jacked-in-the-box.1@example.com', '', 1),
  ('user_wrx_jacked-in-the-box_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sarah', 'Leon', 'jacked-in-the-box.2@example.com', '', 1),
  ('user_wrx_m-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Megan', 'Tweten', 'm-m.1@example.com', '', 1),
  ('user_wrx_m-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Millie', 'Estrada', 'm-m.2@example.com', '', 1),
  ('user_wrx_m-m-mayhem_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Melanie', 'Layne', 'm-m-mayhem.1@example.com', '', 1),
  ('user_wrx_m-m-mayhem_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mariana', 'Rodriguez', 'm-m-mayhem.2@example.com', '', 1),
  ('user_wrx_naddy-the-baddies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nataya', 'Flores', 'naddy-the-baddies.1@example.com', '', 1),
  ('user_wrx_naddy-the-baddies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Addison', 'Coffelt', 'naddy-the-baddies.2@example.com', '', 1),
  ('user_wrx_northside-naptime-ni_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Melissa', 'Maberry', 'northside-naptime-ni.1@example.com', '', 1),
  ('user_wrx_northside-naptime-ni_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Abby', 'Lassen', 'northside-naptime-ni.2@example.com', '', 1),
  ('user_wrx_not-dying-just-gesta_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Katherine', 'Goyn', 'not-dying-just-gesta.1@example.com', '', 1),
  ('user_wrx_not-dying-just-gesta_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lexi', 'Kirkeide', 'not-dying-just-gesta.2@example.com', '', 1),
  ('user_wrx_o-doyle-rules_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Megan', 'Hannah', 'o-doyle-rules.1@example.com', '', 1),
  ('user_wrx_o-doyle-rules_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sami', 'Stoddard', 'o-doyle-rules.2@example.com', '', 1),
  ('user_wrx_power-princesses_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kat', 'Cheatum', 'power-princesses.1@example.com', '', 1),
  ('user_wrx_power-princesses_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Morgan', 'Hirschberg', 'power-princesses.2@example.com', '', 1),
  ('user_wrx_quad-squad_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bailey', 'Parsons', 'quad-squad.1@example.com', '', 1),
  ('user_wrx_quad-squad_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Layla', 'von Berndt', 'quad-squad.2@example.com', '', 1),
  ('user_wrx_snatching-with-siren_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Avery', 'Jesmer', 'snatching-with-siren.1@example.com', '', 1),
  ('user_wrx_snatching-with-siren_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ellia', 'Miller', 'snatching-with-siren.2@example.com', '', 1),
  ('user_wrx_supermom-squad_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tiffany', 'Taylor', 'supermom-squad.1@example.com', '', 1),
  ('user_wrx_supermom-squad_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Alma', 'Crow', 'supermom-squad.2@example.com', '', 1);

-- Athlete Teams for Women's - RX
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_wrx_arbor-mcfit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Arbor McFit', 'arbor-mcfit', 'athlete', NULL),
  ('team_wrx_hannah-montana', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hannah Montana', 'hannah-montana', 'athlete', NULL),
  ('team_wrx_hot-mess-express', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hot Mess Express', 'hot-mess-express', 'athlete', NULL),
  ('team_wrx_jacked-in-the-box', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jacked in the Box', 'jacked-in-the-box', 'athlete', NULL),
  ('team_wrx_m-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'M&M', 'm-m', 'athlete', NULL),
  ('team_wrx_m-m-mayhem', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'M&M Mayhem', 'm-m-mayhem', 'athlete', NULL),
  ('team_wrx_naddy-the-baddies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Naddy the baddies', 'naddy-the-baddies', 'athlete', NULL),
  ('team_wrx_northside-naptime-ni', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Northside Naptime Ninjas', 'northside-naptime-ni', 'athlete', NULL),
  ('team_wrx_not-dying-just-gesta', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Not Dying, Just Gestating', 'not-dying-just-gesta', 'athlete', NULL),
  ('team_wrx_o-doyle-rules', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'O’Doyle Rules', 'o-doyle-rules', 'athlete', NULL),
  ('team_wrx_power-princesses', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Power Princesses', 'power-princesses', 'athlete', NULL),
  ('team_wrx_quad-squad', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Quad Squad', 'quad-squad', 'athlete', NULL),
  ('team_wrx_snatching-with-siren', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Snatching with Sirens', 'snatching-with-siren', 'athlete', NULL),
  ('team_wrx_supermom-squad', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'SuperMom Squad', 'supermom-squad', 'athlete', NULL);

-- Team Memberships for Women's - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_wrx_arbor-mcfit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_arbor-mcfit', 'user_wrx_arbor-mcfit_1', 'admin', 1),
  ('tm_wrx_arbor-mcfit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_arbor-mcfit', 'user_wrx_arbor-mcfit_2', 'member', 1),
  ('tm_wrx_hannah-montana_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_hannah-montana', 'user_wrx_hannah-montana_1', 'admin', 1),
  ('tm_wrx_hannah-montana_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_hannah-montana', 'user_wrx_hannah-montana_2', 'member', 1),
  ('tm_wrx_hot-mess-express_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_hot-mess-express', 'user_wrx_hot-mess-express_1', 'admin', 1),
  ('tm_wrx_hot-mess-express_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_hot-mess-express', 'user_wrx_hot-mess-express_2', 'member', 1),
  ('tm_wrx_jacked-in-the-box_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_jacked-in-the-box', 'user_wrx_jacked-in-the-box_1', 'admin', 1),
  ('tm_wrx_jacked-in-the-box_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_jacked-in-the-box', 'user_wrx_jacked-in-the-box_2', 'member', 1),
  ('tm_wrx_m-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_m-m', 'user_wrx_m-m_1', 'admin', 1),
  ('tm_wrx_m-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_m-m', 'user_wrx_m-m_2', 'member', 1),
  ('tm_wrx_m-m-mayhem_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_m-m-mayhem', 'user_wrx_m-m-mayhem_1', 'admin', 1),
  ('tm_wrx_m-m-mayhem_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_m-m-mayhem', 'user_wrx_m-m-mayhem_2', 'member', 1),
  ('tm_wrx_naddy-the-baddies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_naddy-the-baddies', 'user_wrx_naddy-the-baddies_1', 'admin', 1),
  ('tm_wrx_naddy-the-baddies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_naddy-the-baddies', 'user_wrx_naddy-the-baddies_2', 'member', 1),
  ('tm_wrx_northside-naptime-ni_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_northside-naptime-ni', 'user_wrx_northside-naptime-ni_1', 'admin', 1),
  ('tm_wrx_northside-naptime-ni_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_northside-naptime-ni', 'user_wrx_northside-naptime-ni_2', 'member', 1),
  ('tm_wrx_not-dying-just-gesta_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_not-dying-just-gesta', 'user_wrx_not-dying-just-gesta_1', 'admin', 1),
  ('tm_wrx_not-dying-just-gesta_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_not-dying-just-gesta', 'user_wrx_not-dying-just-gesta_2', 'member', 1),
  ('tm_wrx_o-doyle-rules_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_o-doyle-rules', 'user_wrx_o-doyle-rules_1', 'admin', 1),
  ('tm_wrx_o-doyle-rules_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_o-doyle-rules', 'user_wrx_o-doyle-rules_2', 'member', 1),
  ('tm_wrx_power-princesses_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_power-princesses', 'user_wrx_power-princesses_1', 'admin', 1),
  ('tm_wrx_power-princesses_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_power-princesses', 'user_wrx_power-princesses_2', 'member', 1),
  ('tm_wrx_quad-squad_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_quad-squad', 'user_wrx_quad-squad_1', 'admin', 1),
  ('tm_wrx_quad-squad_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_quad-squad', 'user_wrx_quad-squad_2', 'member', 1),
  ('tm_wrx_snatching-with-siren_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_snatching-with-siren', 'user_wrx_snatching-with-siren_1', 'admin', 1),
  ('tm_wrx_snatching-with-siren_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_snatching-with-siren', 'user_wrx_snatching-with-siren_2', 'member', 1),
  ('tm_wrx_supermom-squad_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_supermom-squad', 'user_wrx_supermom-squad_1', 'admin', 1),
  ('tm_wrx_supermom-squad_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrx_supermom-squad', 'user_wrx_supermom-squad_2', 'member', 1);

-- Event Team Memberships for Women's - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_wrx_arbor-mcfit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_arbor-mcfit_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_arbor-mcfit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_arbor-mcfit_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_hannah-montana_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_hannah-montana_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_hannah-montana_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_hannah-montana_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_hot-mess-express_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_hot-mess-express_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_hot-mess-express_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_hot-mess-express_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_jacked-in-the-box_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_jacked-in-the-box_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_jacked-in-the-box_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_jacked-in-the-box_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_m-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_m-m_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_m-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_m-m_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_m-m-mayhem_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_m-m-mayhem_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_m-m-mayhem_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_m-m-mayhem_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_naddy-the-baddies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_naddy-the-baddies_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_naddy-the-baddies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_naddy-the-baddies_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_northside-naptime-ni_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_northside-naptime-ni_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_northside-naptime-ni_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_northside-naptime-ni_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_not-dying-just-gesta_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_not-dying-just-gesta_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_not-dying-just-gesta_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_not-dying-just-gesta_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_o-doyle-rules_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_o-doyle-rules_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_o-doyle-rules_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_o-doyle-rules_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_power-princesses_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_power-princesses_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_power-princesses_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_power-princesses_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_quad-squad_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_quad-squad_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_quad-squad_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_quad-squad_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_snatching-with-siren_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_snatching-with-siren_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_snatching-with-siren_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_snatching-with-siren_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_supermom-squad_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_supermom-squad_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrx_supermom-squad_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrx_supermom-squad_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Women's - RX ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_wrx_arbor-mcfit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_arbor-mcfit_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_hannah-montana', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_hannah-montana_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_hot-mess-express', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_hot-mess-express_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_jacked-in-the-box', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_jacked-in-the-box_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_m-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_m-m_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_m-m-mayhem', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_m-m-mayhem_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_naddy-the-baddies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_naddy-the-baddies_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_northside-naptime-ni', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_northside-naptime-ni_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_not-dying-just-gesta', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_not-dying-just-gesta_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_o-doyle-rules', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_o-doyle-rules_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_power-princesses', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_power-princesses_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_quad-squad', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_quad-squad_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_snatching-with-siren', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_snatching-with-siren_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrx_supermom-squad', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrx_supermom-squad_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Women's - RX
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_wrx_arbor-mcfit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_arbor-mcfit_1', 'tmem_evt_wrx_arbor-mcfit_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Arbor McFit', 'user_wrx_arbor-mcfit_1', 'team_wrx_arbor-mcfit', 'cpur_wrx_arbor-mcfit', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_hannah-montana', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_hannah-montana_1', 'tmem_evt_wrx_hannah-montana_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Hannah Montana', 'user_wrx_hannah-montana_1', 'team_wrx_hannah-montana', 'cpur_wrx_hannah-montana', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_hot-mess-express', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_hot-mess-express_1', 'tmem_evt_wrx_hot-mess-express_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Hot Mess Express', 'user_wrx_hot-mess-express_1', 'team_wrx_hot-mess-express', 'cpur_wrx_hot-mess-express', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_jacked-in-the-box', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_jacked-in-the-box_1', 'tmem_evt_wrx_jacked-in-the-box_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Jacked in the Box', 'user_wrx_jacked-in-the-box_1', 'team_wrx_jacked-in-the-box', 'cpur_wrx_jacked-in-the-box', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_m-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_m-m_1', 'tmem_evt_wrx_m-m_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'M&M', 'user_wrx_m-m_1', 'team_wrx_m-m', 'cpur_wrx_m-m', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_m-m-mayhem', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_m-m-mayhem_1', 'tmem_evt_wrx_m-m-mayhem_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'M&M Mayhem', 'user_wrx_m-m-mayhem_1', 'team_wrx_m-m-mayhem', 'cpur_wrx_m-m-mayhem', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_naddy-the-baddies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_naddy-the-baddies_1', 'tmem_evt_wrx_naddy-the-baddies_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Naddy the baddies', 'user_wrx_naddy-the-baddies_1', 'team_wrx_naddy-the-baddies', 'cpur_wrx_naddy-the-baddies', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_northside-naptime-ni', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_northside-naptime-ni_1', 'tmem_evt_wrx_northside-naptime-ni_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Northside Naptime Ninjas', 'user_wrx_northside-naptime-ni_1', 'team_wrx_northside-naptime-ni', 'cpur_wrx_northside-naptime-ni', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_not-dying-just-gesta', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_not-dying-just-gesta_1', 'tmem_evt_wrx_not-dying-just-gesta_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Not Dying, Just Gestating', 'user_wrx_not-dying-just-gesta_1', 'team_wrx_not-dying-just-gesta', 'cpur_wrx_not-dying-just-gesta', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_o-doyle-rules', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_o-doyle-rules_1', 'tmem_evt_wrx_o-doyle-rules_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'O’Doyle Rules', 'user_wrx_o-doyle-rules_1', 'team_wrx_o-doyle-rules', 'cpur_wrx_o-doyle-rules', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_power-princesses', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_power-princesses_1', 'tmem_evt_wrx_power-princesses_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Power Princesses', 'user_wrx_power-princesses_1', 'team_wrx_power-princesses', 'cpur_wrx_power-princesses', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_quad-squad', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_quad-squad_1', 'tmem_evt_wrx_quad-squad_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Quad Squad', 'user_wrx_quad-squad_1', 'team_wrx_quad-squad', 'cpur_wrx_quad-squad', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_snatching-with-siren', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_snatching-with-siren_1', 'tmem_evt_wrx_snatching-with-siren_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'Snatching with Sirens', 'user_wrx_snatching-with-siren_1', 'team_wrx_snatching-with-siren', 'cpur_wrx_snatching-with-siren', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrx_supermom-squad', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrx_supermom-squad_1', 'tmem_evt_wrx_supermom-squad_1', 'slvl_mwfc_womens_rx', strftime('%s', '2025-08-01'), 'SuperMom Squad', 'user_wrx_supermom-squad_1', 'team_wrx_supermom-squad', 'cpur_wrx_supermom-squad', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MEN'S - INTERMEDIATE
-- Division ID: slvl_mwfc_mens_int (Competition Corner: 104736)
-- 20 teams
-- ============================================

-- Users for Men's - Intermediate
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mint_burpees-and-biscuits_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Charlie', 'Myers', 'burpees-and-biscuits.1@example.com', '', 1),
  ('user_mint_burpees-and-biscuits_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chris', 'Lecornu', 'burpees-and-biscuits.2@example.com', '', 1),
  ('user_mint_burrito-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mason', 'Vallejo', 'burrito-bros.1@example.com', '', 1),
  ('user_mint_burrito-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jonathan', 'Renteria', 'burrito-bros.2@example.com', '', 1),
  ('user_mint_factory-doughnutties_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Erik', 'Guzman', 'factory-doughnutties.1@example.com', '', 1),
  ('user_mint_factory-doughnutties_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Juan', 'Ruiz', 'factory-doughnutties.2@example.com', '', 1),
  ('user_mint_fourth-and-wod_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Robbie', 'Boggan', 'fourth-and-wod.1@example.com', '', 1),
  ('user_mint_fourth-and-wod_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ronald', 'Mullins', 'fourth-and-wod.2@example.com', '', 1),
  ('user_mint_grab-em-by-the-dumbb_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Brayden', 'Garver', 'grab-em-by-the-dumbb.1@example.com', '', 1),
  ('user_mint_grab-em-by-the-dumbb_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'David', 'Anaya', 'grab-em-by-the-dumbb.2@example.com', '', 1),
  ('user_mint_high-bar-low-bar_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Joshua', 'Ball', 'high-bar-low-bar.1@example.com', '', 1),
  ('user_mint_high-bar-low-bar_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Thomas', 'Yeandle', 'high-bar-low-bar.2@example.com', '', 1),
  ('user_mint_howen_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hunter', 'Winslow', 'howen.1@example.com', '', 1),
  ('user_mint_howen_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Owen', 'Burbank', 'howen.2@example.com', '', 1),
  ('user_mint_mileage-mayhem_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tyler', 'Layne', 'mileage-mayhem.1@example.com', '', 1),
  ('user_mint_mileage-mayhem_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ALEX', 'WHITE', 'mileage-mayhem.2@example.com', '', 1),
  ('user_mint_peter-parkers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Boss', 'Parker', 'peter-parkers.1@example.com', '', 1),
  ('user_mint_peter-parkers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Isaac', 'Peters', 'peter-parkers.2@example.com', '', 1),
  ('user_mint_pupsiki_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Radomyr', 'Herasymchuk', 'pupsiki.1@example.com', '', 1),
  ('user_mint_pupsiki_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Vasyl', 'Prindyn', 'pupsiki.2@example.com', '', 1),
  ('user_mint_stratton-oakmont-cro_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rob', 'Dawley', 'stratton-oakmont-cro.1@example.com', '', 1),
  ('user_mint_stratton-oakmont-cro_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Neil', 'Bastendorff', 'stratton-oakmont-cro.2@example.com', '', 1),
  ('user_mint_strong-independent-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jon', 'Sustaita', 'strong-independent-m.1@example.com', '', 1),
  ('user_mint_strong-independent-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Skyler', 'Fussner', 'strong-independent-m.2@example.com', '', 1),
  ('user_mint_sugar-daddies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Samuel', 'Troutt', 'sugar-daddies.1@example.com', '', 1),
  ('user_mint_sugar-daddies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tommy', 'Stolz', 'sugar-daddies.2@example.com', '', 1),
  ('user_mint_summit-seekers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Justin', 'Orban', 'summit-seekers.1@example.com', '', 1),
  ('user_mint_summit-seekers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nathaniel', 'Ralston', 'summit-seekers.2@example.com', '', 1),
  ('user_mint_team-nonchalant_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chase', 'Arrington', 'team-nonchalant.1@example.com', '', 1),
  ('user_mint_team-nonchalant_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Anthony', 'Accetta', 'team-nonchalant.2@example.com', '', 1),
  ('user_mint_team-saiyan_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ty', 'Owen', 'team-saiyan.1@example.com', '', 1),
  ('user_mint_team-saiyan_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Talon', 'Mcconnell', 'team-saiyan.2@example.com', '', 1),
  ('user_mint_the-swolemates_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Joey', 'Arreygue', 'the-swolemates.1@example.com', '', 1),
  ('user_mint_the-swolemates_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Austin', 'Clifford', 'the-swolemates.2@example.com', '', 1),
  ('user_mint_the-team-that-shall-_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chris', 'Lenington', 'the-team-that-shall-.1@example.com', '', 1),
  ('user_mint_the-team-that-shall-_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Zach', 'Mccleery', 'the-team-that-shall-.2@example.com', '', 1),
  ('user_mint_train-town_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jordan', 'Grubbs', 'train-town.1@example.com', '', 1),
  ('user_mint_train-town_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nico', 'Wirtz', 'train-town.2@example.com', '', 1),
  ('user_mint_twin-turbo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Zac', 'Jones', 'twin-turbo.1@example.com', '', 1),
  ('user_mint_twin-turbo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ian', 'Jones', 'twin-turbo.2@example.com', '', 1);

-- Athlete Teams for Men's - Intermediate
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mint_burpees-and-biscuits', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Burpees and Biscuits', 'burpees-and-biscuits', 'athlete', NULL),
  ('team_mint_burrito-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Burrito Bros', 'burrito-bros', 'athlete', NULL),
  ('team_mint_factory-doughnutties', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Factory Doughnutties', 'factory-doughnutties', 'athlete', NULL),
  ('team_mint_fourth-and-wod', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Fourth and WOD', 'fourth-and-wod', 'athlete', NULL),
  ('team_mint_grab-em-by-the-dumbb', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Grab em by the dumbbells', 'grab-em-by-the-dumbb', 'athlete', NULL),
  ('team_mint_high-bar-low-bar', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'High Bar Low Bar', 'high-bar-low-bar', 'athlete', NULL),
  ('team_mint_howen', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Howen', 'howen', 'athlete', NULL),
  ('team_mint_mileage-mayhem', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mileage & Mayhem', 'mileage-mayhem', 'athlete', NULL),
  ('team_mint_peter-parkers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Peter Parkers', 'peter-parkers', 'athlete', NULL),
  ('team_mint_pupsiki', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Pupsiki', 'pupsiki', 'athlete', NULL),
  ('team_mint_stratton-oakmont-cro', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Stratton Oakmont Crossfit', 'stratton-oakmont-cro', 'athlete', NULL),
  ('team_mint_strong-independent-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Strong Independent Men', 'strong-independent-m', 'athlete', NULL),
  ('team_mint_sugar-daddies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sugar Daddies', 'sugar-daddies', 'athlete', NULL),
  ('team_mint_summit-seekers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Summit Seekers', 'summit-seekers', 'athlete', NULL),
  ('team_mint_team-nonchalant', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Team Nonchalant', 'team-nonchalant', 'athlete', NULL),
  ('team_mint_team-saiyan', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Team saiyan', 'team-saiyan', 'athlete', NULL),
  ('team_mint_the-swolemates', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Swolemates', 'the-swolemates', 'athlete', NULL),
  ('team_mint_the-team-that-shall-', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Team That Shall Not Be Named', 'the-team-that-shall-', 'athlete', NULL),
  ('team_mint_train-town', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Train Town', 'train-town', 'athlete', NULL),
  ('team_mint_twin-turbo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Twin turbo', 'twin-turbo', 'athlete', NULL);

-- Team Memberships for Men's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mint_burpees-and-biscuits_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_burpees-and-biscuits', 'user_mint_burpees-and-biscuits_1', 'admin', 1),
  ('tm_mint_burpees-and-biscuits_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_burpees-and-biscuits', 'user_mint_burpees-and-biscuits_2', 'member', 1),
  ('tm_mint_burrito-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_burrito-bros', 'user_mint_burrito-bros_1', 'admin', 1),
  ('tm_mint_burrito-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_burrito-bros', 'user_mint_burrito-bros_2', 'member', 1),
  ('tm_mint_factory-doughnutties_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_factory-doughnutties', 'user_mint_factory-doughnutties_1', 'admin', 1),
  ('tm_mint_factory-doughnutties_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_factory-doughnutties', 'user_mint_factory-doughnutties_2', 'member', 1),
  ('tm_mint_fourth-and-wod_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_fourth-and-wod', 'user_mint_fourth-and-wod_1', 'admin', 1),
  ('tm_mint_fourth-and-wod_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_fourth-and-wod', 'user_mint_fourth-and-wod_2', 'member', 1),
  ('tm_mint_grab-em-by-the-dumbb_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_grab-em-by-the-dumbb', 'user_mint_grab-em-by-the-dumbb_1', 'admin', 1),
  ('tm_mint_grab-em-by-the-dumbb_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_grab-em-by-the-dumbb', 'user_mint_grab-em-by-the-dumbb_2', 'member', 1),
  ('tm_mint_high-bar-low-bar_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_high-bar-low-bar', 'user_mint_high-bar-low-bar_1', 'admin', 1),
  ('tm_mint_high-bar-low-bar_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_high-bar-low-bar', 'user_mint_high-bar-low-bar_2', 'member', 1),
  ('tm_mint_howen_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_howen', 'user_mint_howen_1', 'admin', 1),
  ('tm_mint_howen_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_howen', 'user_mint_howen_2', 'member', 1),
  ('tm_mint_mileage-mayhem_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_mileage-mayhem', 'user_mint_mileage-mayhem_1', 'admin', 1),
  ('tm_mint_mileage-mayhem_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_mileage-mayhem', 'user_mint_mileage-mayhem_2', 'member', 1),
  ('tm_mint_peter-parkers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_peter-parkers', 'user_mint_peter-parkers_1', 'admin', 1),
  ('tm_mint_peter-parkers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_peter-parkers', 'user_mint_peter-parkers_2', 'member', 1),
  ('tm_mint_pupsiki_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_pupsiki', 'user_mint_pupsiki_1', 'admin', 1),
  ('tm_mint_pupsiki_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_pupsiki', 'user_mint_pupsiki_2', 'member', 1),
  ('tm_mint_stratton-oakmont-cro_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_stratton-oakmont-cro', 'user_mint_stratton-oakmont-cro_1', 'admin', 1),
  ('tm_mint_stratton-oakmont-cro_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_stratton-oakmont-cro', 'user_mint_stratton-oakmont-cro_2', 'member', 1),
  ('tm_mint_strong-independent-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_strong-independent-m', 'user_mint_strong-independent-m_1', 'admin', 1),
  ('tm_mint_strong-independent-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_strong-independent-m', 'user_mint_strong-independent-m_2', 'member', 1),
  ('tm_mint_sugar-daddies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_sugar-daddies', 'user_mint_sugar-daddies_1', 'admin', 1),
  ('tm_mint_sugar-daddies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_sugar-daddies', 'user_mint_sugar-daddies_2', 'member', 1),
  ('tm_mint_summit-seekers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_summit-seekers', 'user_mint_summit-seekers_1', 'admin', 1),
  ('tm_mint_summit-seekers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_summit-seekers', 'user_mint_summit-seekers_2', 'member', 1),
  ('tm_mint_team-nonchalant_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_team-nonchalant', 'user_mint_team-nonchalant_1', 'admin', 1),
  ('tm_mint_team-nonchalant_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_team-nonchalant', 'user_mint_team-nonchalant_2', 'member', 1),
  ('tm_mint_team-saiyan_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_team-saiyan', 'user_mint_team-saiyan_1', 'admin', 1),
  ('tm_mint_team-saiyan_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_team-saiyan', 'user_mint_team-saiyan_2', 'member', 1),
  ('tm_mint_the-swolemates_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_the-swolemates', 'user_mint_the-swolemates_1', 'admin', 1),
  ('tm_mint_the-swolemates_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_the-swolemates', 'user_mint_the-swolemates_2', 'member', 1),
  ('tm_mint_the-team-that-shall-_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_the-team-that-shall-', 'user_mint_the-team-that-shall-_1', 'admin', 1),
  ('tm_mint_the-team-that-shall-_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_the-team-that-shall-', 'user_mint_the-team-that-shall-_2', 'member', 1),
  ('tm_mint_train-town_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_train-town', 'user_mint_train-town_1', 'admin', 1),
  ('tm_mint_train-town_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_train-town', 'user_mint_train-town_2', 'member', 1),
  ('tm_mint_twin-turbo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_twin-turbo', 'user_mint_twin-turbo_1', 'admin', 1),
  ('tm_mint_twin-turbo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mint_twin-turbo', 'user_mint_twin-turbo_2', 'member', 1);

-- Event Team Memberships for Men's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mint_burpees-and-biscuits_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_burpees-and-biscuits_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_burpees-and-biscuits_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_burpees-and-biscuits_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_burrito-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_burrito-bros_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_burrito-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_burrito-bros_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_factory-doughnutties_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_factory-doughnutties_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_factory-doughnutties_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_factory-doughnutties_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_fourth-and-wod_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_fourth-and-wod_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_fourth-and-wod_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_fourth-and-wod_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_grab-em-by-the-dumbb_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_grab-em-by-the-dumbb_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_grab-em-by-the-dumbb_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_grab-em-by-the-dumbb_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_high-bar-low-bar_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_high-bar-low-bar_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_high-bar-low-bar_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_high-bar-low-bar_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_howen_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_howen_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_howen_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_howen_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_mileage-mayhem_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_mileage-mayhem_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_mileage-mayhem_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_mileage-mayhem_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_peter-parkers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_peter-parkers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_peter-parkers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_peter-parkers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_pupsiki_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_pupsiki_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_pupsiki_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_pupsiki_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_stratton-oakmont-cro_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_stratton-oakmont-cro_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_stratton-oakmont-cro_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_stratton-oakmont-cro_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_strong-independent-m_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_strong-independent-m_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_strong-independent-m_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_strong-independent-m_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_sugar-daddies_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_sugar-daddies_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_sugar-daddies_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_sugar-daddies_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_summit-seekers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_summit-seekers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_summit-seekers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_summit-seekers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_team-nonchalant_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_team-nonchalant_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_team-nonchalant_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_team-nonchalant_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_team-saiyan_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_team-saiyan_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_team-saiyan_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_team-saiyan_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_the-swolemates_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_the-swolemates_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_the-swolemates_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_the-swolemates_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_the-team-that-shall-_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_the-team-that-shall-_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_the-team-that-shall-_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_the-team-that-shall-_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_train-town_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_train-town_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_train-town_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_train-town_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_twin-turbo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_twin-turbo_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mint_twin-turbo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mint_twin-turbo_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Men's - Intermediate ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mint_burpees-and-biscuits', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_burpees-and-biscuits_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_burrito-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_burrito-bros_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_factory-doughnutties', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_factory-doughnutties_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_fourth-and-wod', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_fourth-and-wod_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_grab-em-by-the-dumbb', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_grab-em-by-the-dumbb_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_high-bar-low-bar', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_high-bar-low-bar_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_howen', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_howen_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_mileage-mayhem', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_mileage-mayhem_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_peter-parkers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_peter-parkers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_pupsiki', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_pupsiki_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_stratton-oakmont-cro', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_stratton-oakmont-cro_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_strong-independent-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_strong-independent-m_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_sugar-daddies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_sugar-daddies_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_summit-seekers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_summit-seekers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_team-nonchalant', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_team-nonchalant_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_team-saiyan', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_team-saiyan_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_the-swolemates', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_the-swolemates_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_the-team-that-shall-', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_the-team-that-shall-_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_train-town', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_train-town_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mint_twin-turbo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mint_twin-turbo_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Men's - Intermediate
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mint_burpees-and-biscuits', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_burpees-and-biscuits_1', 'tmem_evt_mint_burpees-and-biscuits_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Burpees and Biscuits', 'user_mint_burpees-and-biscuits_1', 'team_mint_burpees-and-biscuits', 'cpur_mint_burpees-and-biscuits', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_burrito-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_burrito-bros_1', 'tmem_evt_mint_burrito-bros_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Burrito Bros', 'user_mint_burrito-bros_1', 'team_mint_burrito-bros', 'cpur_mint_burrito-bros', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_factory-doughnutties', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_factory-doughnutties_1', 'tmem_evt_mint_factory-doughnutties_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Factory Doughnutties', 'user_mint_factory-doughnutties_1', 'team_mint_factory-doughnutties', 'cpur_mint_factory-doughnutties', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_fourth-and-wod', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_fourth-and-wod_1', 'tmem_evt_mint_fourth-and-wod_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Fourth and WOD', 'user_mint_fourth-and-wod_1', 'team_mint_fourth-and-wod', 'cpur_mint_fourth-and-wod', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_grab-em-by-the-dumbb', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_grab-em-by-the-dumbb_1', 'tmem_evt_mint_grab-em-by-the-dumbb_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Grab em by the dumbbells', 'user_mint_grab-em-by-the-dumbb_1', 'team_mint_grab-em-by-the-dumbb', 'cpur_mint_grab-em-by-the-dumbb', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_high-bar-low-bar', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_high-bar-low-bar_1', 'tmem_evt_mint_high-bar-low-bar_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'High Bar Low Bar', 'user_mint_high-bar-low-bar_1', 'team_mint_high-bar-low-bar', 'cpur_mint_high-bar-low-bar', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_howen', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_howen_1', 'tmem_evt_mint_howen_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Howen', 'user_mint_howen_1', 'team_mint_howen', 'cpur_mint_howen', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_mileage-mayhem', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_mileage-mayhem_1', 'tmem_evt_mint_mileage-mayhem_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Mileage & Mayhem', 'user_mint_mileage-mayhem_1', 'team_mint_mileage-mayhem', 'cpur_mint_mileage-mayhem', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_peter-parkers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_peter-parkers_1', 'tmem_evt_mint_peter-parkers_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Peter Parkers', 'user_mint_peter-parkers_1', 'team_mint_peter-parkers', 'cpur_mint_peter-parkers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_pupsiki', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_pupsiki_1', 'tmem_evt_mint_pupsiki_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Pupsiki', 'user_mint_pupsiki_1', 'team_mint_pupsiki', 'cpur_mint_pupsiki', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_stratton-oakmont-cro', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_stratton-oakmont-cro_1', 'tmem_evt_mint_stratton-oakmont-cro_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Stratton Oakmont Crossfit', 'user_mint_stratton-oakmont-cro_1', 'team_mint_stratton-oakmont-cro', 'cpur_mint_stratton-oakmont-cro', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_strong-independent-m', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_strong-independent-m_1', 'tmem_evt_mint_strong-independent-m_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Strong Independent Men', 'user_mint_strong-independent-m_1', 'team_mint_strong-independent-m', 'cpur_mint_strong-independent-m', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_sugar-daddies', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_sugar-daddies_1', 'tmem_evt_mint_sugar-daddies_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Sugar Daddies', 'user_mint_sugar-daddies_1', 'team_mint_sugar-daddies', 'cpur_mint_sugar-daddies', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_summit-seekers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_summit-seekers_1', 'tmem_evt_mint_summit-seekers_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Summit Seekers', 'user_mint_summit-seekers_1', 'team_mint_summit-seekers', 'cpur_mint_summit-seekers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_team-nonchalant', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_team-nonchalant_1', 'tmem_evt_mint_team-nonchalant_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Team Nonchalant', 'user_mint_team-nonchalant_1', 'team_mint_team-nonchalant', 'cpur_mint_team-nonchalant', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_team-saiyan', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_team-saiyan_1', 'tmem_evt_mint_team-saiyan_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Team saiyan', 'user_mint_team-saiyan_1', 'team_mint_team-saiyan', 'cpur_mint_team-saiyan', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_the-swolemates', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_the-swolemates_1', 'tmem_evt_mint_the-swolemates_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'The Swolemates', 'user_mint_the-swolemates_1', 'team_mint_the-swolemates', 'cpur_mint_the-swolemates', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_the-team-that-shall-', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_the-team-that-shall-_1', 'tmem_evt_mint_the-team-that-shall-_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'The Team That Shall Not Be Named', 'user_mint_the-team-that-shall-_1', 'team_mint_the-team-that-shall-', 'cpur_mint_the-team-that-shall-', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_train-town', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_train-town_1', 'tmem_evt_mint_train-town_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Train Town', 'user_mint_train-town_1', 'team_mint_train-town', 'cpur_mint_train-town', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mint_twin-turbo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mint_twin-turbo_1', 'tmem_evt_mint_twin-turbo_1', 'slvl_mwfc_mens_int', strftime('%s', '2025-08-01'), 'Twin turbo', 'user_mint_twin-turbo_1', 'team_mint_twin-turbo', 'cpur_mint_twin-turbo', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MEN'S - ROOKIE
-- Division ID: slvl_mwfc_mens_rookie (Competition Corner: 104737)
-- 8 teams
-- ============================================

-- Users for Men's - Rookie
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mrook_brown-and-down_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'James', 'Sandoval', 'brown-and-down.1@example.com', '', 1),
  ('user_mrook_brown-and-down_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cristian', 'Sanchez', 'brown-and-down.2@example.com', '', 1),
  ('user_mrook_gym-bruvz_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Spencer', 'Burnham', 'gym-bruvz.1@example.com', '', 1),
  ('user_mrook_gym-bruvz_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Evan', 'Maynard', 'gym-bruvz.2@example.com', '', 1),
  ('user_mrook_last-minute-lifters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Colt', 'Thurston', 'last-minute-lifters.1@example.com', '', 1),
  ('user_mrook_last-minute-lifters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Neil', 'Morgon', 'last-minute-lifters.2@example.com', '', 1),
  ('user_mrook_rice-beans_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Isaiah', 'Miranda', 'rice-beans.1@example.com', '', 1),
  ('user_mrook_rice-beans_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Michael', 'Wager', 'rice-beans.2@example.com', '', 1),
  ('user_mrook_rowing-pains_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nick', 'Roth', 'rowing-pains.1@example.com', '', 1),
  ('user_mrook_rowing-pains_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Michael', 'Wiseman', 'rowing-pains.2@example.com', '', 1),
  ('user_mrook_sweaty-and-regrety_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Justin', 'Russell', 'sweaty-and-regrety.1@example.com', '', 1),
  ('user_mrook_sweaty-and-regrety_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jay', 'Cadwell', 'sweaty-and-regrety.2@example.com', '', 1),
  ('user_mrook_the-team-the-team-go_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ethan', 'Rhodes', 'the-team-the-team-go.1@example.com', '', 1),
  ('user_mrook_the-team-the-team-go_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cory', 'Bernaiche', 'the-team-the-team-go.2@example.com', '', 1),
  ('user_mrook_young-bull-old-goat_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dave', 'Stewart', 'young-bull-old-goat.1@example.com', '', 1),
  ('user_mrook_young-bull-old-goat_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tyler', 'Burton', 'young-bull-old-goat.2@example.com', '', 1);

-- Athlete Teams for Men's - Rookie
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mrook_brown-and-down', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Brown and Down', 'brown-and-down', 'athlete', NULL),
  ('team_mrook_gym-bruvz', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Gym Bruvz', 'gym-bruvz', 'athlete', NULL),
  ('team_mrook_last-minute-lifters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Last Minute Lifters', 'last-minute-lifters', 'athlete', NULL),
  ('team_mrook_rice-beans', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rice & Beans', 'rice-beans', 'athlete', NULL),
  ('team_mrook_rowing-pains', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rowing Pains', 'rowing-pains', 'athlete', NULL),
  ('team_mrook_sweaty-and-regrety', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sweaty and Regrety', 'sweaty-and-regrety', 'athlete', NULL),
  ('team_mrook_the-team-the-team-go', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The team, the team, go team', 'the-team-the-team-go', 'athlete', NULL),
  ('team_mrook_young-bull-old-goat', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Young Bull & Old Goat', 'young-bull-old-goat', 'athlete', NULL);

-- Team Memberships for Men's - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mrook_brown-and-down_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_brown-and-down', 'user_mrook_brown-and-down_1', 'admin', 1),
  ('tm_mrook_brown-and-down_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_brown-and-down', 'user_mrook_brown-and-down_2', 'member', 1),
  ('tm_mrook_gym-bruvz_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_gym-bruvz', 'user_mrook_gym-bruvz_1', 'admin', 1),
  ('tm_mrook_gym-bruvz_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_gym-bruvz', 'user_mrook_gym-bruvz_2', 'member', 1),
  ('tm_mrook_last-minute-lifters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_last-minute-lifters', 'user_mrook_last-minute-lifters_1', 'admin', 1),
  ('tm_mrook_last-minute-lifters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_last-minute-lifters', 'user_mrook_last-minute-lifters_2', 'member', 1),
  ('tm_mrook_rice-beans_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_rice-beans', 'user_mrook_rice-beans_1', 'admin', 1),
  ('tm_mrook_rice-beans_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_rice-beans', 'user_mrook_rice-beans_2', 'member', 1),
  ('tm_mrook_rowing-pains_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_rowing-pains', 'user_mrook_rowing-pains_1', 'admin', 1),
  ('tm_mrook_rowing-pains_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_rowing-pains', 'user_mrook_rowing-pains_2', 'member', 1),
  ('tm_mrook_sweaty-and-regrety_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_sweaty-and-regrety', 'user_mrook_sweaty-and-regrety_1', 'admin', 1),
  ('tm_mrook_sweaty-and-regrety_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_sweaty-and-regrety', 'user_mrook_sweaty-and-regrety_2', 'member', 1),
  ('tm_mrook_the-team-the-team-go_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_the-team-the-team-go', 'user_mrook_the-team-the-team-go_1', 'admin', 1),
  ('tm_mrook_the-team-the-team-go_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_the-team-the-team-go', 'user_mrook_the-team-the-team-go_2', 'member', 1),
  ('tm_mrook_young-bull-old-goat_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_young-bull-old-goat', 'user_mrook_young-bull-old-goat_1', 'admin', 1),
  ('tm_mrook_young-bull-old-goat_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrook_young-bull-old-goat', 'user_mrook_young-bull-old-goat_2', 'member', 1);

-- Event Team Memberships for Men's - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mrook_brown-and-down_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_brown-and-down_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_brown-and-down_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_brown-and-down_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_gym-bruvz_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_gym-bruvz_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_gym-bruvz_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_gym-bruvz_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_last-minute-lifters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_last-minute-lifters_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_last-minute-lifters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_last-minute-lifters_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_rice-beans_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_rice-beans_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_rice-beans_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_rice-beans_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_rowing-pains_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_rowing-pains_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_rowing-pains_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_rowing-pains_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_sweaty-and-regrety_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_sweaty-and-regrety_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_sweaty-and-regrety_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_sweaty-and-regrety_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_the-team-the-team-go_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_the-team-the-team-go_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_the-team-the-team-go_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_the-team-the-team-go_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_young-bull-old-goat_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_young-bull-old-goat_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mrook_young-bull-old-goat_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrook_young-bull-old-goat_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Men's - Rookie ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mrook_brown-and-down', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_brown-and-down_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_gym-bruvz', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_gym-bruvz_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_last-minute-lifters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_last-minute-lifters_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_rice-beans', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_rice-beans_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_rowing-pains', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_rowing-pains_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_sweaty-and-regrety', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_sweaty-and-regrety_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_the-team-the-team-go', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_the-team-the-team-go_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrook_young-bull-old-goat', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrook_young-bull-old-goat_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Men's - Rookie
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mrook_brown-and-down', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_brown-and-down_1', 'tmem_evt_mrook_brown-and-down_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Brown and Down', 'user_mrook_brown-and-down_1', 'team_mrook_brown-and-down', 'cpur_mrook_brown-and-down', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_gym-bruvz', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_gym-bruvz_1', 'tmem_evt_mrook_gym-bruvz_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Gym Bruvz', 'user_mrook_gym-bruvz_1', 'team_mrook_gym-bruvz', 'cpur_mrook_gym-bruvz', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_last-minute-lifters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_last-minute-lifters_1', 'tmem_evt_mrook_last-minute-lifters_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Last Minute Lifters', 'user_mrook_last-minute-lifters_1', 'team_mrook_last-minute-lifters', 'cpur_mrook_last-minute-lifters', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_rice-beans', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_rice-beans_1', 'tmem_evt_mrook_rice-beans_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Rice & Beans', 'user_mrook_rice-beans_1', 'team_mrook_rice-beans', 'cpur_mrook_rice-beans', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_rowing-pains', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_rowing-pains_1', 'tmem_evt_mrook_rowing-pains_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Rowing Pains', 'user_mrook_rowing-pains_1', 'team_mrook_rowing-pains', 'cpur_mrook_rowing-pains', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_sweaty-and-regrety', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_sweaty-and-regrety_1', 'tmem_evt_mrook_sweaty-and-regrety_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Sweaty and Regrety', 'user_mrook_sweaty-and-regrety_1', 'team_mrook_sweaty-and-regrety', 'cpur_mrook_sweaty-and-regrety', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_the-team-the-team-go', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_the-team-the-team-go_1', 'tmem_evt_mrook_the-team-the-team-go_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'The team, the team, go team', 'user_mrook_the-team-the-team-go_1', 'team_mrook_the-team-the-team-go', 'cpur_mrook_the-team-the-team-go', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrook_young-bull-old-goat', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrook_young-bull-old-goat_1', 'tmem_evt_mrook_young-bull-old-goat_1', 'slvl_mwfc_mens_rookie', strftime('%s', '2025-08-01'), 'Young Bull & Old Goat', 'user_mrook_young-bull-old-goat_1', 'team_mrook_young-bull-old-goat', 'cpur_mrook_young-bull-old-goat', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- WOMEN'S - INTERMEDIATE
-- Division ID: slvl_mwfc_womens_int (Competition Corner: 104738)
-- 16 teams
-- ============================================

-- Users for Women's - Intermediate
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_wint_critter-gitters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Alli', 'Price', 'critter-gitters.1@example.com', '', 1),
  ('user_wint_critter-gitters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Carlee', 'Olivera', 'critter-gitters.2@example.com', '', 1),
  ('user_wint_double-wonders_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Julia', 'Moreira', 'double-wonders.1@example.com', '', 1),
  ('user_wint_double-wonders_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Danna', 'Williams', 'double-wonders.2@example.com', '', 1),
  ('user_wint_down-bad-crying-at-t_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rachel', 'Burnham', 'down-bad-crying-at-t.1@example.com', '', 1),
  ('user_wint_down-bad-crying-at-t_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Abbigayle', 'Miranda', 'down-bad-crying-at-t.2@example.com', '', 1),
  ('user_wint_flexual-healing_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Taylor', 'Gregory', 'flexual-healing.1@example.com', '', 1),
  ('user_wint_flexual-healing_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lindsi', 'Lee', 'flexual-healing.2@example.com', '', 1),
  ('user_wint_gabz-and-make-it-rai_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kseniya', 'Blyakherova', 'gabz-and-make-it-rai.1@example.com', '', 1),
  ('user_wint_gabz-and-make-it-rai_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rainy', 'Spears', 'gabz-and-make-it-rai.2@example.com', '', 1),
  ('user_wint_grins-and-wins_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Larissa', 'Macfarlane', 'grins-and-wins.1@example.com', '', 1),
  ('user_wint_grins-and-wins_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rachel', ' Kirchmeyer', 'grins-and-wins.2@example.com', '', 1),
  ('user_wint_hot-mom-era_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Willa', 'Lynch', 'hot-mom-era.1@example.com', '', 1),
  ('user_wint_hot-mom-era_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Destanee', 'Stulken', 'hot-mom-era.2@example.com', '', 1),
  ('user_wint_hustle-muscle_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Shelby', 'Hemenway', 'hustle-muscle.1@example.com', '', 1),
  ('user_wint_hustle-muscle_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Emma', 'Myers', 'hustle-muscle.2@example.com', '', 1),
  ('user_wint_long-distance-lifter_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Aubrey', 'Nesheim', 'long-distance-lifter.1@example.com', '', 1),
  ('user_wint_long-distance-lifter_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Carrie', 'Graham', 'long-distance-lifter.2@example.com', '', 1),
  ('user_wint_misplaced-masters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Maria', 'Onaindia', 'misplaced-masters.1@example.com', '', 1),
  ('user_wint_misplaced-masters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Megan', 'Norcross', 'misplaced-masters.2@example.com', '', 1),
  ('user_wint_pr-or-er_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Olivia', 'Nielson', 'pr-or-er.1@example.com', '', 1),
  ('user_wint_pr-or-er_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ASHLEY', 'ROBERTS', 'pr-or-er.2@example.com', '', 1),
  ('user_wint_social-hour_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ronnie', 'Hulce', 'social-hour.1@example.com', '', 1),
  ('user_wint_social-hour_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Elizabeth', 'Johnson', 'social-hour.2@example.com', '', 1),
  ('user_wint_the-power-puff-girls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Audrey', 'Barlow', 'the-power-puff-girls.1@example.com', '', 1),
  ('user_wint_the-power-puff-girls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Katie', 'Austin', 'the-power-puff-girls.2@example.com', '', 1),
  ('user_wint_thunder-lightning_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bailee', 'Spooner', 'thunder-lightning.1@example.com', '', 1),
  ('user_wint_thunder-lightning_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Amber', 'Gregg', 'thunder-lightning.2@example.com', '', 1),
  ('user_wint_verdant-vixens_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chanel', 'Carter', 'verdant-vixens.1@example.com', '', 1),
  ('user_wint_verdant-vixens_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Macey', 'Maceyvasquez4@Gmail.Com', 'verdant-vixens.2@example.com', '', 1),
  ('user_wint_woddesses_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Livi', 'Anderson', 'woddesses.1@example.com', '', 1),
  ('user_wint_woddesses_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Carin', 'Pryor', 'woddesses.2@example.com', '', 1);

-- Athlete Teams for Women's - Intermediate
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_wint_critter-gitters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Critter Gitters', 'critter-gitters', 'athlete', NULL),
  ('team_wint_double-wonders', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Double Wonders', 'double-wonders', 'athlete', NULL),
  ('team_wint_down-bad-crying-at-t', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Down Bad Crying at the Gym', 'down-bad-crying-at-t', 'athlete', NULL),
  ('team_wint_flexual-healing', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Flexual Healing', 'flexual-healing', 'athlete', NULL),
  ('team_wint_gabz-and-make-it-rai', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Gabz and Make it Rainz', 'gabz-and-make-it-rai', 'athlete', NULL),
  ('team_wint_grins-and-wins', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Grins and Wins', 'grins-and-wins', 'athlete', NULL),
  ('team_wint_hot-mom-era', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hot Mom Era', 'hot-mom-era', 'athlete', NULL),
  ('team_wint_hustle-muscle', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hustle & Muscle', 'hustle-muscle', 'athlete', NULL),
  ('team_wint_long-distance-lifter', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Long Distance Lifters', 'long-distance-lifter', 'athlete', NULL),
  ('team_wint_misplaced-masters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Misplaced Masters', 'misplaced-masters', 'athlete', NULL),
  ('team_wint_pr-or-er', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'PR or ER', 'pr-or-er', 'athlete', NULL),
  ('team_wint_social-hour', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Social Hour', 'social-hour', 'athlete', NULL),
  ('team_wint_the-power-puff-girls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Power Puff Girls', 'the-power-puff-girls', 'athlete', NULL),
  ('team_wint_thunder-lightning', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Thunder & Lightning', 'thunder-lightning', 'athlete', NULL),
  ('team_wint_verdant-vixens', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Verdant Vixens', 'verdant-vixens', 'athlete', NULL),
  ('team_wint_woddesses', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Woddesses', 'woddesses', 'athlete', NULL);

-- Team Memberships for Women's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_wint_critter-gitters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_critter-gitters', 'user_wint_critter-gitters_1', 'admin', 1),
  ('tm_wint_critter-gitters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_critter-gitters', 'user_wint_critter-gitters_2', 'member', 1),
  ('tm_wint_double-wonders_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_double-wonders', 'user_wint_double-wonders_1', 'admin', 1),
  ('tm_wint_double-wonders_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_double-wonders', 'user_wint_double-wonders_2', 'member', 1),
  ('tm_wint_down-bad-crying-at-t_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_down-bad-crying-at-t', 'user_wint_down-bad-crying-at-t_1', 'admin', 1),
  ('tm_wint_down-bad-crying-at-t_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_down-bad-crying-at-t', 'user_wint_down-bad-crying-at-t_2', 'member', 1),
  ('tm_wint_flexual-healing_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_flexual-healing', 'user_wint_flexual-healing_1', 'admin', 1),
  ('tm_wint_flexual-healing_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_flexual-healing', 'user_wint_flexual-healing_2', 'member', 1),
  ('tm_wint_gabz-and-make-it-rai_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_gabz-and-make-it-rai', 'user_wint_gabz-and-make-it-rai_1', 'admin', 1),
  ('tm_wint_gabz-and-make-it-rai_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_gabz-and-make-it-rai', 'user_wint_gabz-and-make-it-rai_2', 'member', 1),
  ('tm_wint_grins-and-wins_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_grins-and-wins', 'user_wint_grins-and-wins_1', 'admin', 1),
  ('tm_wint_grins-and-wins_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_grins-and-wins', 'user_wint_grins-and-wins_2', 'member', 1),
  ('tm_wint_hot-mom-era_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_hot-mom-era', 'user_wint_hot-mom-era_1', 'admin', 1),
  ('tm_wint_hot-mom-era_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_hot-mom-era', 'user_wint_hot-mom-era_2', 'member', 1),
  ('tm_wint_hustle-muscle_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_hustle-muscle', 'user_wint_hustle-muscle_1', 'admin', 1),
  ('tm_wint_hustle-muscle_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_hustle-muscle', 'user_wint_hustle-muscle_2', 'member', 1),
  ('tm_wint_long-distance-lifter_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_long-distance-lifter', 'user_wint_long-distance-lifter_1', 'admin', 1),
  ('tm_wint_long-distance-lifter_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_long-distance-lifter', 'user_wint_long-distance-lifter_2', 'member', 1),
  ('tm_wint_misplaced-masters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_misplaced-masters', 'user_wint_misplaced-masters_1', 'admin', 1),
  ('tm_wint_misplaced-masters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_misplaced-masters', 'user_wint_misplaced-masters_2', 'member', 1),
  ('tm_wint_pr-or-er_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_pr-or-er', 'user_wint_pr-or-er_1', 'admin', 1),
  ('tm_wint_pr-or-er_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_pr-or-er', 'user_wint_pr-or-er_2', 'member', 1),
  ('tm_wint_social-hour_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_social-hour', 'user_wint_social-hour_1', 'admin', 1),
  ('tm_wint_social-hour_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_social-hour', 'user_wint_social-hour_2', 'member', 1),
  ('tm_wint_the-power-puff-girls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_the-power-puff-girls', 'user_wint_the-power-puff-girls_1', 'admin', 1),
  ('tm_wint_the-power-puff-girls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_the-power-puff-girls', 'user_wint_the-power-puff-girls_2', 'member', 1),
  ('tm_wint_thunder-lightning_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_thunder-lightning', 'user_wint_thunder-lightning_1', 'admin', 1),
  ('tm_wint_thunder-lightning_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_thunder-lightning', 'user_wint_thunder-lightning_2', 'member', 1),
  ('tm_wint_verdant-vixens_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_verdant-vixens', 'user_wint_verdant-vixens_1', 'admin', 1),
  ('tm_wint_verdant-vixens_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_verdant-vixens', 'user_wint_verdant-vixens_2', 'member', 1),
  ('tm_wint_woddesses_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_woddesses', 'user_wint_woddesses_1', 'admin', 1),
  ('tm_wint_woddesses_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wint_woddesses', 'user_wint_woddesses_2', 'member', 1);

-- Event Team Memberships for Women's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_wint_critter-gitters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_critter-gitters_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_critter-gitters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_critter-gitters_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_double-wonders_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_double-wonders_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_double-wonders_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_double-wonders_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_down-bad-crying-at-t_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_down-bad-crying-at-t_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_down-bad-crying-at-t_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_down-bad-crying-at-t_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_flexual-healing_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_flexual-healing_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_flexual-healing_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_flexual-healing_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_gabz-and-make-it-rai_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_gabz-and-make-it-rai_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_gabz-and-make-it-rai_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_gabz-and-make-it-rai_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_grins-and-wins_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_grins-and-wins_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_grins-and-wins_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_grins-and-wins_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_hot-mom-era_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_hot-mom-era_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_hot-mom-era_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_hot-mom-era_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_hustle-muscle_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_hustle-muscle_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_hustle-muscle_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_hustle-muscle_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_long-distance-lifter_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_long-distance-lifter_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_long-distance-lifter_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_long-distance-lifter_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_misplaced-masters_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_misplaced-masters_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_misplaced-masters_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_misplaced-masters_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_pr-or-er_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_pr-or-er_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_pr-or-er_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_pr-or-er_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_social-hour_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_social-hour_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_social-hour_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_social-hour_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_the-power-puff-girls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_the-power-puff-girls_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_the-power-puff-girls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_the-power-puff-girls_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_thunder-lightning_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_thunder-lightning_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_thunder-lightning_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_thunder-lightning_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_verdant-vixens_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_verdant-vixens_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_verdant-vixens_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_verdant-vixens_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_woddesses_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_woddesses_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wint_woddesses_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wint_woddesses_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Women's - Intermediate ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_wint_critter-gitters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_critter-gitters_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_double-wonders', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_double-wonders_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_down-bad-crying-at-t', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_down-bad-crying-at-t_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_flexual-healing', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_flexual-healing_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_gabz-and-make-it-rai', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_gabz-and-make-it-rai_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_grins-and-wins', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_grins-and-wins_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_hot-mom-era', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_hot-mom-era_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_hustle-muscle', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_hustle-muscle_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_long-distance-lifter', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_long-distance-lifter_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_misplaced-masters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_misplaced-masters_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_pr-or-er', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_pr-or-er_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_social-hour', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_social-hour_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_the-power-puff-girls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_the-power-puff-girls_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_thunder-lightning', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_thunder-lightning_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_verdant-vixens', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_verdant-vixens_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wint_woddesses', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wint_woddesses_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Women's - Intermediate
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_wint_critter-gitters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_critter-gitters_1', 'tmem_evt_wint_critter-gitters_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Critter Gitters', 'user_wint_critter-gitters_1', 'team_wint_critter-gitters', 'cpur_wint_critter-gitters', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_double-wonders', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_double-wonders_1', 'tmem_evt_wint_double-wonders_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Double Wonders', 'user_wint_double-wonders_1', 'team_wint_double-wonders', 'cpur_wint_double-wonders', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_down-bad-crying-at-t', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_down-bad-crying-at-t_1', 'tmem_evt_wint_down-bad-crying-at-t_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Down Bad Crying at the Gym', 'user_wint_down-bad-crying-at-t_1', 'team_wint_down-bad-crying-at-t', 'cpur_wint_down-bad-crying-at-t', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_flexual-healing', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_flexual-healing_1', 'tmem_evt_wint_flexual-healing_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Flexual Healing', 'user_wint_flexual-healing_1', 'team_wint_flexual-healing', 'cpur_wint_flexual-healing', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_gabz-and-make-it-rai', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_gabz-and-make-it-rai_1', 'tmem_evt_wint_gabz-and-make-it-rai_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Gabz and Make it Rainz', 'user_wint_gabz-and-make-it-rai_1', 'team_wint_gabz-and-make-it-rai', 'cpur_wint_gabz-and-make-it-rai', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_grins-and-wins', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_grins-and-wins_1', 'tmem_evt_wint_grins-and-wins_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Grins and Wins', 'user_wint_grins-and-wins_1', 'team_wint_grins-and-wins', 'cpur_wint_grins-and-wins', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_hot-mom-era', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_hot-mom-era_1', 'tmem_evt_wint_hot-mom-era_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Hot Mom Era', 'user_wint_hot-mom-era_1', 'team_wint_hot-mom-era', 'cpur_wint_hot-mom-era', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_hustle-muscle', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_hustle-muscle_1', 'tmem_evt_wint_hustle-muscle_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Hustle & Muscle', 'user_wint_hustle-muscle_1', 'team_wint_hustle-muscle', 'cpur_wint_hustle-muscle', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_long-distance-lifter', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_long-distance-lifter_1', 'tmem_evt_wint_long-distance-lifter_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Long Distance Lifters', 'user_wint_long-distance-lifter_1', 'team_wint_long-distance-lifter', 'cpur_wint_long-distance-lifter', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_misplaced-masters', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_misplaced-masters_1', 'tmem_evt_wint_misplaced-masters_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Misplaced Masters', 'user_wint_misplaced-masters_1', 'team_wint_misplaced-masters', 'cpur_wint_misplaced-masters', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_pr-or-er', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_pr-or-er_1', 'tmem_evt_wint_pr-or-er_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'PR or ER', 'user_wint_pr-or-er_1', 'team_wint_pr-or-er', 'cpur_wint_pr-or-er', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_social-hour', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_social-hour_1', 'tmem_evt_wint_social-hour_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Social Hour', 'user_wint_social-hour_1', 'team_wint_social-hour', 'cpur_wint_social-hour', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_the-power-puff-girls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_the-power-puff-girls_1', 'tmem_evt_wint_the-power-puff-girls_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'The Power Puff Girls', 'user_wint_the-power-puff-girls_1', 'team_wint_the-power-puff-girls', 'cpur_wint_the-power-puff-girls', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_thunder-lightning', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_thunder-lightning_1', 'tmem_evt_wint_thunder-lightning_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Thunder & Lightning', 'user_wint_thunder-lightning_1', 'team_wint_thunder-lightning', 'cpur_wint_thunder-lightning', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_verdant-vixens', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_verdant-vixens_1', 'tmem_evt_wint_verdant-vixens_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Verdant Vixens', 'user_wint_verdant-vixens_1', 'team_wint_verdant-vixens', 'cpur_wint_verdant-vixens', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wint_woddesses', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wint_woddesses_1', 'tmem_evt_wint_woddesses_1', 'slvl_mwfc_womens_int', strftime('%s', '2025-08-01'), 'Woddesses', 'user_wint_woddesses_1', 'team_wint_woddesses', 'cpur_wint_woddesses', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- WOMEN'S - ROOKIE
-- Division ID: slvl_mwfc_womens_rookie (Competition Corner: 104739)
-- 15 teams
-- ============================================

-- Users for Women's - Rookie
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_wrook_2-snatched-2-quit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Alesha', 'Harper', '2-snatched-2-quit.1@example.com', '', 1),
  ('user_wrook_2-snatched-2-quit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'STEVIE', 'DE YOUNG', '2-snatched-2-quit.2@example.com', '', 1),
  ('user_wrook_bend-and-snap_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sabrina', 'Chang', 'bend-and-snap.1@example.com', '', 1),
  ('user_wrook_bend-and-snap_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Amaris', 'Carnley', 'bend-and-snap.2@example.com', '', 1),
  ('user_wrook_chalk-dirty-to-me_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Amy', 'Arteaga', 'chalk-dirty-to-me.1@example.com', '', 1),
  ('user_wrook_chalk-dirty-to-me_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Daniela', 'Gonzalez', 'chalk-dirty-to-me.2@example.com', '', 1),
  ('user_wrook_dog-mom-duo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Katirah', 'Vangaasbeck', 'dog-mom-duo.1@example.com', '', 1),
  ('user_wrook_dog-mom-duo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hannah', 'Dolby', 'dog-mom-duo.2@example.com', '', 1),
  ('user_wrook_flex-appeal_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rebecca', 'Torres', 'flex-appeal.1@example.com', '', 1),
  ('user_wrook_flex-appeal_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jenna', 'O’Brien', 'flex-appeal.2@example.com', '', 1),
  ('user_wrook_floss-n-fades_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lucia', 'Alvarez', 'floss-n-fades.1@example.com', '', 1),
  ('user_wrook_floss-n-fades_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kindra', 'Cutler', 'floss-n-fades.2@example.com', '', 1),
  ('user_wrook_grit-grace_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jade', 'Copper', 'grit-grace.1@example.com', '', 1),
  ('user_wrook_grit-grace_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Natasha', 'Naumchuk', 'grit-grace.2@example.com', '', 1),
  ('user_wrook_kettlebelles_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Brooklyn', 'Gardiner', 'kettlebelles.1@example.com', '', 1),
  ('user_wrook_kettlebelles_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Annie', 'Hofman', 'kettlebelles.2@example.com', '', 1),
  ('user_wrook_look-wod-you-made-me_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lisa', 'Ball', 'look-wod-you-made-me.1@example.com', '', 1),
  ('user_wrook_look-wod-you-made-me_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tanya', 'Cates', 'look-wod-you-made-me.2@example.com', '', 1),
  ('user_wrook_masters-in-motion_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tenille', 'Mortensen', 'masters-in-motion.1@example.com', '', 1),
  ('user_wrook_masters-in-motion_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Torrie', 'Berry', 'masters-in-motion.2@example.com', '', 1),
  ('user_wrook_mother-hustlers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Cortnee', 'Staley', 'mother-hustlers.1@example.com', '', 1),
  ('user_wrook_mother-hustlers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tisha', 'Christensen', 'mother-hustlers.2@example.com', '', 1),
  ('user_wrook_muscle-milkmaids_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jasmine', 'Bingham', 'muscle-milkmaids.1@example.com', '', 1),
  ('user_wrook_muscle-milkmaids_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kelly', 'Prigge', 'muscle-milkmaids.2@example.com', '', 1),
  ('user_wrook_oh-snatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Stacey', 'Clark', 'oh-snatch.1@example.com', '', 1),
  ('user_wrook_oh-snatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Leann', 'Young', 'oh-snatch.2@example.com', '', 1),
  ('user_wrook_the-cougar-and-the-k_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Barbara', 'Morrison', 'the-cougar-and-the-k.1@example.com', '', 1),
  ('user_wrook_the-cougar-and-the-k_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Molly', 'Hodges', 'the-cougar-and-the-k.2@example.com', '', 1),
  ('user_wrook_we-were-on-a-break_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ashlee', 'Toland', 'we-were-on-a-break.1@example.com', '', 1),
  ('user_wrook_we-were-on-a-break_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'KAILA', 'SANCHEZ', 'we-were-on-a-break.2@example.com', '', 1);

-- Athlete Teams for Women's - Rookie
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_wrook_2-snatched-2-quit', strftime('%s', 'now'), strftime('%s', 'now'), 1, '2 Snatched 2 Quit', '2-snatched-2-quit', 'athlete', NULL),
  ('team_wrook_bend-and-snap', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bend and Snap', 'bend-and-snap', 'athlete', NULL),
  ('team_wrook_chalk-dirty-to-me', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chalk Dirty to me', 'chalk-dirty-to-me', 'athlete', NULL),
  ('team_wrook_dog-mom-duo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dog Mom Duo', 'dog-mom-duo', 'athlete', NULL),
  ('team_wrook_flex-appeal', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Flex Appeal', 'flex-appeal', 'athlete', NULL),
  ('team_wrook_floss-n-fades', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Floss n'' Fades', 'floss-n-fades', 'athlete', NULL),
  ('team_wrook_grit-grace', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Grit & Grace', 'grit-grace', 'athlete', NULL),
  ('team_wrook_kettlebelles', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kettlebelles', 'kettlebelles', 'athlete', NULL),
  ('team_wrook_look-wod-you-made-me', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Look WOD You Made Me Do', 'look-wod-you-made-me', 'athlete', NULL),
  ('team_wrook_masters-in-motion', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Masters in Motion', 'masters-in-motion', 'athlete', NULL),
  ('team_wrook_mother-hustlers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mother Hustlers', 'mother-hustlers', 'athlete', NULL),
  ('team_wrook_muscle-milkmaids', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Muscle Milkmaids', 'muscle-milkmaids', 'athlete', NULL),
  ('team_wrook_oh-snatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Oh Snatch!', 'oh-snatch', 'athlete', NULL),
  ('team_wrook_the-cougar-and-the-k', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Cougar and the Kitten', 'the-cougar-and-the-k', 'athlete', NULL),
  ('team_wrook_we-were-on-a-break', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'We Were On A Break', 'we-were-on-a-break', 'athlete', NULL);

-- Team Memberships for Women's - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_wrook_2-snatched-2-quit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_2-snatched-2-quit', 'user_wrook_2-snatched-2-quit_1', 'admin', 1),
  ('tm_wrook_2-snatched-2-quit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_2-snatched-2-quit', 'user_wrook_2-snatched-2-quit_2', 'member', 1),
  ('tm_wrook_bend-and-snap_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_bend-and-snap', 'user_wrook_bend-and-snap_1', 'admin', 1),
  ('tm_wrook_bend-and-snap_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_bend-and-snap', 'user_wrook_bend-and-snap_2', 'member', 1),
  ('tm_wrook_chalk-dirty-to-me_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_chalk-dirty-to-me', 'user_wrook_chalk-dirty-to-me_1', 'admin', 1),
  ('tm_wrook_chalk-dirty-to-me_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_chalk-dirty-to-me', 'user_wrook_chalk-dirty-to-me_2', 'member', 1),
  ('tm_wrook_dog-mom-duo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_dog-mom-duo', 'user_wrook_dog-mom-duo_1', 'admin', 1),
  ('tm_wrook_dog-mom-duo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_dog-mom-duo', 'user_wrook_dog-mom-duo_2', 'member', 1),
  ('tm_wrook_flex-appeal_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_flex-appeal', 'user_wrook_flex-appeal_1', 'admin', 1),
  ('tm_wrook_flex-appeal_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_flex-appeal', 'user_wrook_flex-appeal_2', 'member', 1),
  ('tm_wrook_floss-n-fades_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_floss-n-fades', 'user_wrook_floss-n-fades_1', 'admin', 1),
  ('tm_wrook_floss-n-fades_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_floss-n-fades', 'user_wrook_floss-n-fades_2', 'member', 1),
  ('tm_wrook_grit-grace_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_grit-grace', 'user_wrook_grit-grace_1', 'admin', 1),
  ('tm_wrook_grit-grace_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_grit-grace', 'user_wrook_grit-grace_2', 'member', 1),
  ('tm_wrook_kettlebelles_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_kettlebelles', 'user_wrook_kettlebelles_1', 'admin', 1),
  ('tm_wrook_kettlebelles_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_kettlebelles', 'user_wrook_kettlebelles_2', 'member', 1),
  ('tm_wrook_look-wod-you-made-me_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_look-wod-you-made-me', 'user_wrook_look-wod-you-made-me_1', 'admin', 1),
  ('tm_wrook_look-wod-you-made-me_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_look-wod-you-made-me', 'user_wrook_look-wod-you-made-me_2', 'member', 1),
  ('tm_wrook_masters-in-motion_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_masters-in-motion', 'user_wrook_masters-in-motion_1', 'admin', 1),
  ('tm_wrook_masters-in-motion_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_masters-in-motion', 'user_wrook_masters-in-motion_2', 'member', 1),
  ('tm_wrook_mother-hustlers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_mother-hustlers', 'user_wrook_mother-hustlers_1', 'admin', 1),
  ('tm_wrook_mother-hustlers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_mother-hustlers', 'user_wrook_mother-hustlers_2', 'member', 1),
  ('tm_wrook_muscle-milkmaids_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_muscle-milkmaids', 'user_wrook_muscle-milkmaids_1', 'admin', 1),
  ('tm_wrook_muscle-milkmaids_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_muscle-milkmaids', 'user_wrook_muscle-milkmaids_2', 'member', 1),
  ('tm_wrook_oh-snatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_oh-snatch', 'user_wrook_oh-snatch_1', 'admin', 1),
  ('tm_wrook_oh-snatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_oh-snatch', 'user_wrook_oh-snatch_2', 'member', 1),
  ('tm_wrook_the-cougar-and-the-k_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_the-cougar-and-the-k', 'user_wrook_the-cougar-and-the-k_1', 'admin', 1),
  ('tm_wrook_the-cougar-and-the-k_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_the-cougar-and-the-k', 'user_wrook_the-cougar-and-the-k_2', 'member', 1),
  ('tm_wrook_we-were-on-a-break_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_we-were-on-a-break', 'user_wrook_we-were-on-a-break_1', 'admin', 1),
  ('tm_wrook_we-were-on-a-break_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_wrook_we-were-on-a-break', 'user_wrook_we-were-on-a-break_2', 'member', 1);

-- Event Team Memberships for Women's - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_wrook_2-snatched-2-quit_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_2-snatched-2-quit_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_2-snatched-2-quit_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_2-snatched-2-quit_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_bend-and-snap_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_bend-and-snap_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_bend-and-snap_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_bend-and-snap_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_chalk-dirty-to-me_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_chalk-dirty-to-me_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_chalk-dirty-to-me_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_chalk-dirty-to-me_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_dog-mom-duo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_dog-mom-duo_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_dog-mom-duo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_dog-mom-duo_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_flex-appeal_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_flex-appeal_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_flex-appeal_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_flex-appeal_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_floss-n-fades_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_floss-n-fades_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_floss-n-fades_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_floss-n-fades_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_grit-grace_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_grit-grace_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_grit-grace_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_grit-grace_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_kettlebelles_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_kettlebelles_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_kettlebelles_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_kettlebelles_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_look-wod-you-made-me_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_look-wod-you-made-me_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_look-wod-you-made-me_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_look-wod-you-made-me_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_masters-in-motion_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_masters-in-motion_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_masters-in-motion_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_masters-in-motion_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_mother-hustlers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_mother-hustlers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_mother-hustlers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_mother-hustlers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_muscle-milkmaids_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_muscle-milkmaids_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_muscle-milkmaids_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_muscle-milkmaids_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_oh-snatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_oh-snatch_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_oh-snatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_oh-snatch_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_the-cougar-and-the-k_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_the-cougar-and-the-k_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_the-cougar-and-the-k_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_the-cougar-and-the-k_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_we-were-on-a-break_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_we-were-on-a-break_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_wrook_we-were-on-a-break_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_wrook_we-were-on-a-break_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Women's - Rookie ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_wrook_2-snatched-2-quit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_2-snatched-2-quit_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_bend-and-snap', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_bend-and-snap_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_chalk-dirty-to-me', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_chalk-dirty-to-me_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_dog-mom-duo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_dog-mom-duo_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_flex-appeal', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_flex-appeal_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_floss-n-fades', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_floss-n-fades_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_grit-grace', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_grit-grace_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_kettlebelles', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_kettlebelles_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_look-wod-you-made-me', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_look-wod-you-made-me_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_masters-in-motion', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_masters-in-motion_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_mother-hustlers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_mother-hustlers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_muscle-milkmaids', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_muscle-milkmaids_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_oh-snatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_oh-snatch_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_the-cougar-and-the-k', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_the-cougar-and-the-k_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_wrook_we-were-on-a-break', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_wrook_we-were-on-a-break_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Women's - Rookie
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_wrook_2-snatched-2-quit', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_2-snatched-2-quit_1', 'tmem_evt_wrook_2-snatched-2-quit_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), '2 Snatched 2 Quit', 'user_wrook_2-snatched-2-quit_1', 'team_wrook_2-snatched-2-quit', 'cpur_wrook_2-snatched-2-quit', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_bend-and-snap', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_bend-and-snap_1', 'tmem_evt_wrook_bend-and-snap_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Bend and Snap', 'user_wrook_bend-and-snap_1', 'team_wrook_bend-and-snap', 'cpur_wrook_bend-and-snap', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_chalk-dirty-to-me', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_chalk-dirty-to-me_1', 'tmem_evt_wrook_chalk-dirty-to-me_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Chalk Dirty to me', 'user_wrook_chalk-dirty-to-me_1', 'team_wrook_chalk-dirty-to-me', 'cpur_wrook_chalk-dirty-to-me', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_dog-mom-duo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_dog-mom-duo_1', 'tmem_evt_wrook_dog-mom-duo_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Dog Mom Duo', 'user_wrook_dog-mom-duo_1', 'team_wrook_dog-mom-duo', 'cpur_wrook_dog-mom-duo', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_flex-appeal', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_flex-appeal_1', 'tmem_evt_wrook_flex-appeal_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Flex Appeal', 'user_wrook_flex-appeal_1', 'team_wrook_flex-appeal', 'cpur_wrook_flex-appeal', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_floss-n-fades', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_floss-n-fades_1', 'tmem_evt_wrook_floss-n-fades_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Floss n'' Fades', 'user_wrook_floss-n-fades_1', 'team_wrook_floss-n-fades', 'cpur_wrook_floss-n-fades', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_grit-grace', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_grit-grace_1', 'tmem_evt_wrook_grit-grace_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Grit & Grace', 'user_wrook_grit-grace_1', 'team_wrook_grit-grace', 'cpur_wrook_grit-grace', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_kettlebelles', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_kettlebelles_1', 'tmem_evt_wrook_kettlebelles_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Kettlebelles', 'user_wrook_kettlebelles_1', 'team_wrook_kettlebelles', 'cpur_wrook_kettlebelles', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_look-wod-you-made-me', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_look-wod-you-made-me_1', 'tmem_evt_wrook_look-wod-you-made-me_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Look WOD You Made Me Do', 'user_wrook_look-wod-you-made-me_1', 'team_wrook_look-wod-you-made-me', 'cpur_wrook_look-wod-you-made-me', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_masters-in-motion', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_masters-in-motion_1', 'tmem_evt_wrook_masters-in-motion_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Masters in Motion', 'user_wrook_masters-in-motion_1', 'team_wrook_masters-in-motion', 'cpur_wrook_masters-in-motion', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_mother-hustlers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_mother-hustlers_1', 'tmem_evt_wrook_mother-hustlers_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Mother Hustlers', 'user_wrook_mother-hustlers_1', 'team_wrook_mother-hustlers', 'cpur_wrook_mother-hustlers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_muscle-milkmaids', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_muscle-milkmaids_1', 'tmem_evt_wrook_muscle-milkmaids_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Muscle Milkmaids', 'user_wrook_muscle-milkmaids_1', 'team_wrook_muscle-milkmaids', 'cpur_wrook_muscle-milkmaids', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_oh-snatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_oh-snatch_1', 'tmem_evt_wrook_oh-snatch_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'Oh Snatch!', 'user_wrook_oh-snatch_1', 'team_wrook_oh-snatch', 'cpur_wrook_oh-snatch', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_the-cougar-and-the-k', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_the-cougar-and-the-k_1', 'tmem_evt_wrook_the-cougar-and-the-k_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'The Cougar and the Kitten', 'user_wrook_the-cougar-and-the-k_1', 'team_wrook_the-cougar-and-the-k', 'cpur_wrook_the-cougar-and-the-k', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_wrook_we-were-on-a-break', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_wrook_we-were-on-a-break_1', 'tmem_evt_wrook_we-were-on-a-break_1', 'slvl_mwfc_womens_rookie', strftime('%s', '2025-08-01'), 'We Were On A Break', 'user_wrook_we-were-on-a-break_1', 'team_wrook_we-were-on-a-break', 'cpur_wrook_we-were-on-a-break', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MASTERS MEN'S - RX
-- Division ID: slvl_mwfc_masters_mens_rx (Competition Corner: 104740)
-- 10 teams
-- ============================================

-- Users for Masters Men's - RX
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mmrx_barbell-babes_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Clay', 'Braden', 'barbell-babes.1@example.com', '', 1),
  ('user_mmrx_barbell-babes_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kerry', 'Hosken', 'barbell-babes.2@example.com', '', 1),
  ('user_mmrx_bustin_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Austin', 'Case', 'bustin.1@example.com', '', 1),
  ('user_mmrx_bustin_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bennie', 'Crocker', 'bustin.2@example.com', '', 1),
  ('user_mmrx_fireside-centurions_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ben', 'Millemon', 'fireside-centurions.1@example.com', '', 1),
  ('user_mmrx_fireside-centurions_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Micah', 'Johnson', 'fireside-centurions.2@example.com', '', 1),
  ('user_mmrx_northside-thugs-n-ha_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ronnie', 'Rasmussen', 'northside-thugs-n-ha.1@example.com', '', 1),
  ('user_mmrx_northside-thugs-n-ha_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jeremy', 'Wallace', 'northside-thugs-n-ha.2@example.com', '', 1),
  ('user_mmrx_old-broken_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kevin', 'Chrisman', 'old-broken.1@example.com', '', 1),
  ('user_mmrx_old-broken_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Donald', 'LaBar', 'old-broken.2@example.com', '', 1),
  ('user_mmrx_spud-brothers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Buck', 'Jacobs', 'spud-brothers.1@example.com', '', 1),
  ('user_mmrx_spud-brothers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Brandon', 'Spidell', 'spud-brothers.2@example.com', '', 1),
  ('user_mmrx_super-snatch-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Justin', 'Williams', 'super-snatch-bros.1@example.com', '', 1),
  ('user_mmrx_super-snatch-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'DONALD', ' SMITH III', 'super-snatch-bros.2@example.com', '', 1),
  ('user_mmrx_t-c_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Thayne', 'Clark', 't-c.1@example.com', '', 1),
  ('user_mmrx_t-c_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Chad', 'Jones', 't-c.2@example.com', '', 1),
  ('user_mmrx_team-propath_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Thatcher', 'Taylor', 'team-propath.1@example.com', '', 1),
  ('user_mmrx_team-propath_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Unknown', 'Partner', 'team-propath.2@example.com', '', 1),
  ('user_mmrx_timmy-and-the-brain_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Timothy', 'Diaz', 'timmy-and-the-brain.1@example.com', '', 1),
  ('user_mmrx_timmy-and-the-brain_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'CARVIN', 'COLEMAN', 'timmy-and-the-brain.2@example.com', '', 1);

-- Athlete Teams for Masters Men's - RX
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mmrx_barbell-babes', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Barbell Babes', 'barbell-babes', 'athlete', NULL),
  ('team_mmrx_bustin', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'bustin', 'bustin', 'athlete', NULL),
  ('team_mmrx_fireside-centurions', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Fireside Centurions', 'fireside-centurions', 'athlete', NULL),
  ('team_mmrx_northside-thugs-n-ha', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Northside Thugs N Harmony', 'northside-thugs-n-ha', 'athlete', NULL),
  ('team_mmrx_old-broken', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Old & Broken', 'old-broken', 'athlete', NULL),
  ('team_mmrx_spud-brothers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'SPUD BROTHERS', 'spud-brothers', 'athlete', NULL),
  ('team_mmrx_super-snatch-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Super Snatch Bros.', 'super-snatch-bros', 'athlete', NULL),
  ('team_mmrx_t-c', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'T & C', 't-c', 'athlete', NULL),
  ('team_mmrx_team-propath', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Team PROPATH', 'team-propath', 'athlete', NULL),
  ('team_mmrx_timmy-and-the-brain', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Timmy and the Brain', 'timmy-and-the-brain', 'athlete', NULL);

-- Team Memberships for Masters Men's - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mmrx_barbell-babes_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_barbell-babes', 'user_mmrx_barbell-babes_1', 'admin', 1),
  ('tm_mmrx_barbell-babes_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_barbell-babes', 'user_mmrx_barbell-babes_2', 'member', 1),
  ('tm_mmrx_bustin_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_bustin', 'user_mmrx_bustin_1', 'admin', 1),
  ('tm_mmrx_bustin_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_bustin', 'user_mmrx_bustin_2', 'member', 1),
  ('tm_mmrx_fireside-centurions_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_fireside-centurions', 'user_mmrx_fireside-centurions_1', 'admin', 1),
  ('tm_mmrx_fireside-centurions_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_fireside-centurions', 'user_mmrx_fireside-centurions_2', 'member', 1),
  ('tm_mmrx_northside-thugs-n-ha_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_northside-thugs-n-ha', 'user_mmrx_northside-thugs-n-ha_1', 'admin', 1),
  ('tm_mmrx_northside-thugs-n-ha_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_northside-thugs-n-ha', 'user_mmrx_northside-thugs-n-ha_2', 'member', 1),
  ('tm_mmrx_old-broken_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_old-broken', 'user_mmrx_old-broken_1', 'admin', 1),
  ('tm_mmrx_old-broken_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_old-broken', 'user_mmrx_old-broken_2', 'member', 1),
  ('tm_mmrx_spud-brothers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_spud-brothers', 'user_mmrx_spud-brothers_1', 'admin', 1),
  ('tm_mmrx_spud-brothers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_spud-brothers', 'user_mmrx_spud-brothers_2', 'member', 1),
  ('tm_mmrx_super-snatch-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_super-snatch-bros', 'user_mmrx_super-snatch-bros_1', 'admin', 1),
  ('tm_mmrx_super-snatch-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_super-snatch-bros', 'user_mmrx_super-snatch-bros_2', 'member', 1),
  ('tm_mmrx_t-c_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_t-c', 'user_mmrx_t-c_1', 'admin', 1),
  ('tm_mmrx_t-c_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_t-c', 'user_mmrx_t-c_2', 'member', 1),
  ('tm_mmrx_team-propath_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_team-propath', 'user_mmrx_team-propath_1', 'admin', 1),
  ('tm_mmrx_team-propath_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_team-propath', 'user_mmrx_team-propath_2', 'member', 1),
  ('tm_mmrx_timmy-and-the-brain_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_timmy-and-the-brain', 'user_mmrx_timmy-and-the-brain_1', 'admin', 1),
  ('tm_mmrx_timmy-and-the-brain_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrx_timmy-and-the-brain', 'user_mmrx_timmy-and-the-brain_2', 'member', 1);

-- Event Team Memberships for Masters Men's - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mmrx_barbell-babes_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_barbell-babes_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_barbell-babes_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_barbell-babes_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_bustin_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_bustin_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_bustin_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_bustin_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_fireside-centurions_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_fireside-centurions_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_fireside-centurions_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_fireside-centurions_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_northside-thugs-n-ha_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_northside-thugs-n-ha_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_northside-thugs-n-ha_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_northside-thugs-n-ha_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_old-broken_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_old-broken_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_old-broken_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_old-broken_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_spud-brothers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_spud-brothers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_spud-brothers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_spud-brothers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_super-snatch-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_super-snatch-bros_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_super-snatch-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_super-snatch-bros_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_t-c_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_t-c_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_t-c_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_t-c_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_team-propath_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_team-propath_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_team-propath_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_team-propath_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_timmy-and-the-brain_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_timmy-and-the-brain_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrx_timmy-and-the-brain_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrx_timmy-and-the-brain_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Masters Men's - RX ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mmrx_barbell-babes', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_barbell-babes_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_bustin', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_bustin_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_fireside-centurions', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_fireside-centurions_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_northside-thugs-n-ha', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_northside-thugs-n-ha_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_old-broken', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_old-broken_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_spud-brothers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_spud-brothers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_super-snatch-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_super-snatch-bros_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_t-c', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_t-c_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_team-propath', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_team-propath_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrx_timmy-and-the-brain', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrx_timmy-and-the-brain_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Masters Men's - RX
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mmrx_barbell-babes', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_barbell-babes_1', 'tmem_evt_mmrx_barbell-babes_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Barbell Babes', 'user_mmrx_barbell-babes_1', 'team_mmrx_barbell-babes', 'cpur_mmrx_barbell-babes', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_bustin', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_bustin_1', 'tmem_evt_mmrx_bustin_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'bustin', 'user_mmrx_bustin_1', 'team_mmrx_bustin', 'cpur_mmrx_bustin', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_fireside-centurions', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_fireside-centurions_1', 'tmem_evt_mmrx_fireside-centurions_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Fireside Centurions', 'user_mmrx_fireside-centurions_1', 'team_mmrx_fireside-centurions', 'cpur_mmrx_fireside-centurions', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_northside-thugs-n-ha', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_northside-thugs-n-ha_1', 'tmem_evt_mmrx_northside-thugs-n-ha_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Northside Thugs N Harmony', 'user_mmrx_northside-thugs-n-ha_1', 'team_mmrx_northside-thugs-n-ha', 'cpur_mmrx_northside-thugs-n-ha', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_old-broken', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_old-broken_1', 'tmem_evt_mmrx_old-broken_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Old & Broken', 'user_mmrx_old-broken_1', 'team_mmrx_old-broken', 'cpur_mmrx_old-broken', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_spud-brothers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_spud-brothers_1', 'tmem_evt_mmrx_spud-brothers_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'SPUD BROTHERS', 'user_mmrx_spud-brothers_1', 'team_mmrx_spud-brothers', 'cpur_mmrx_spud-brothers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_super-snatch-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_super-snatch-bros_1', 'tmem_evt_mmrx_super-snatch-bros_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Super Snatch Bros.', 'user_mmrx_super-snatch-bros_1', 'team_mmrx_super-snatch-bros', 'cpur_mmrx_super-snatch-bros', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_t-c', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_t-c_1', 'tmem_evt_mmrx_t-c_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'T & C', 'user_mmrx_t-c_1', 'team_mmrx_t-c', 'cpur_mmrx_t-c', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_team-propath', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_team-propath_1', 'tmem_evt_mmrx_team-propath_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Team PROPATH', 'user_mmrx_team-propath_1', 'team_mmrx_team-propath', 'cpur_mmrx_team-propath', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrx_timmy-and-the-brain', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrx_timmy-and-the-brain_1', 'tmem_evt_mmrx_timmy-and-the-brain_1', 'slvl_mwfc_masters_mens_rx', strftime('%s', '2025-08-01'), 'Timmy and the Brain', 'user_mmrx_timmy-and-the-brain_1', 'team_mmrx_timmy-and-the-brain', 'cpur_mmrx_timmy-and-the-brain', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MASTERS MEN'S - INTERMEDIATE
-- Division ID: slvl_mwfc_masters_mens_int (Competition Corner: 104741)
-- 9 teams
-- ============================================

-- Users for Masters Men's - Intermediate
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mmint_ambiguously-qualifie_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Michael', 'Oleary', 'ambiguously-qualifie.1@example.com', '', 1),
  ('user_mmint_ambiguously-qualifie_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dustin', 'Langer', 'ambiguously-qualifie.2@example.com', '', 1),
  ('user_mmint_check-engine_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Patrick', 'Bulzomi', 'check-engine.1@example.com', '', 1),
  ('user_mmint_check-engine_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Andrew', 'Perttula', 'check-engine.2@example.com', '', 1),
  ('user_mmint_dad-bod-dynasty_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Aaron', 'Holcomb', 'dad-bod-dynasty.1@example.com', '', 1),
  ('user_mmint_dad-bod-dynasty_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Joao', 'Cardoso', 'dad-bod-dynasty.2@example.com', '', 1),
  ('user_mmint_fullertons-old-schoo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Carlos', 'Guadamuz', 'fullertons-old-schoo.1@example.com', '', 1),
  ('user_mmint_fullertons-old-schoo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jay', 'Vallejo', 'fullertons-old-schoo.2@example.com', '', 1),
  ('user_mmint_good_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Drew', 'Barr', 'good.1@example.com', '', 1),
  ('user_mmint_good_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Barry', 'Spooner', 'good.2@example.com', '', 1),
  ('user_mmint_irish-wristwatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Harold', 'Chambers', 'irish-wristwatch.1@example.com', '', 1),
  ('user_mmint_irish-wristwatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Logan', 'Jones', 'irish-wristwatch.2@example.com', '', 1),
  ('user_mmint_obsolete_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Marcos', 'Martinez', 'obsolete.1@example.com', '', 1),
  ('user_mmint_obsolete_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'TJ', 'Butcher', 'obsolete.2@example.com', '', 1),
  ('user_mmint_red_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Eric', 'Wirfs', 'red.1@example.com', '', 1),
  ('user_mmint_red_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tom', 'Gregg', 'red.2@example.com', '', 1),
  ('user_mmint_thruster-i-hardly-kn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jeff', 'Mortensen', 'thruster-i-hardly-kn.1@example.com', '', 1),
  ('user_mmint_thruster-i-hardly-kn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sam', 'Johnson', 'thruster-i-hardly-kn.2@example.com', '', 1);

-- Athlete Teams for Masters Men's - Intermediate
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mmint_ambiguously-qualifie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ambiguously Qualified CrossFit Duo', 'ambiguously-qualifie', 'athlete', NULL),
  ('team_mmint_check-engine', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Check Engine', 'check-engine', 'athlete', NULL),
  ('team_mmint_dad-bod-dynasty', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dad Bod Dynasty', 'dad-bod-dynasty', 'athlete', NULL),
  ('team_mmint_fullertons-old-schoo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Fullerton''s Old School', 'fullertons-old-schoo', 'athlete', NULL),
  ('team_mmint_good', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'GOOD', 'good', 'athlete', NULL),
  ('team_mmint_irish-wristwatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Irish Wristwatch', 'irish-wristwatch', 'athlete', NULL),
  ('team_mmint_obsolete', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'OBSOLETE', 'obsolete', 'athlete', NULL),
  ('team_mmint_red', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Red', 'red', 'athlete', NULL),
  ('team_mmint_thruster-i-hardly-kn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Thruster? I hardly know her', 'thruster-i-hardly-kn', 'athlete', NULL);

-- Team Memberships for Masters Men's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mmint_ambiguously-qualifie_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_ambiguously-qualifie', 'user_mmint_ambiguously-qualifie_1', 'admin', 1),
  ('tm_mmint_ambiguously-qualifie_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_ambiguously-qualifie', 'user_mmint_ambiguously-qualifie_2', 'member', 1),
  ('tm_mmint_check-engine_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_check-engine', 'user_mmint_check-engine_1', 'admin', 1),
  ('tm_mmint_check-engine_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_check-engine', 'user_mmint_check-engine_2', 'member', 1),
  ('tm_mmint_dad-bod-dynasty_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_dad-bod-dynasty', 'user_mmint_dad-bod-dynasty_1', 'admin', 1),
  ('tm_mmint_dad-bod-dynasty_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_dad-bod-dynasty', 'user_mmint_dad-bod-dynasty_2', 'member', 1),
  ('tm_mmint_fullertons-old-schoo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_fullertons-old-schoo', 'user_mmint_fullertons-old-schoo_1', 'admin', 1),
  ('tm_mmint_fullertons-old-schoo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_fullertons-old-schoo', 'user_mmint_fullertons-old-schoo_2', 'member', 1),
  ('tm_mmint_good_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_good', 'user_mmint_good_1', 'admin', 1),
  ('tm_mmint_good_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_good', 'user_mmint_good_2', 'member', 1),
  ('tm_mmint_irish-wristwatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_irish-wristwatch', 'user_mmint_irish-wristwatch_1', 'admin', 1),
  ('tm_mmint_irish-wristwatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_irish-wristwatch', 'user_mmint_irish-wristwatch_2', 'member', 1),
  ('tm_mmint_obsolete_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_obsolete', 'user_mmint_obsolete_1', 'admin', 1),
  ('tm_mmint_obsolete_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_obsolete', 'user_mmint_obsolete_2', 'member', 1),
  ('tm_mmint_red_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_red', 'user_mmint_red_1', 'admin', 1),
  ('tm_mmint_red_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_red', 'user_mmint_red_2', 'member', 1),
  ('tm_mmint_thruster-i-hardly-kn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_thruster-i-hardly-kn', 'user_mmint_thruster-i-hardly-kn_1', 'admin', 1),
  ('tm_mmint_thruster-i-hardly-kn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmint_thruster-i-hardly-kn', 'user_mmint_thruster-i-hardly-kn_2', 'member', 1);

-- Event Team Memberships for Masters Men's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mmint_ambiguously-qualifie_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_ambiguously-qualifie_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_ambiguously-qualifie_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_ambiguously-qualifie_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_check-engine_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_check-engine_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_check-engine_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_check-engine_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_dad-bod-dynasty_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_dad-bod-dynasty_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_dad-bod-dynasty_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_dad-bod-dynasty_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_fullertons-old-schoo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_fullertons-old-schoo_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_fullertons-old-schoo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_fullertons-old-schoo_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_good_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_good_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_good_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_good_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_irish-wristwatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_irish-wristwatch_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_irish-wristwatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_irish-wristwatch_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_obsolete_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_obsolete_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_obsolete_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_obsolete_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_red_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_red_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_red_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_red_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_thruster-i-hardly-kn_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_thruster-i-hardly-kn_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmint_thruster-i-hardly-kn_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmint_thruster-i-hardly-kn_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Masters Men's - Intermediate ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mmint_ambiguously-qualifie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_ambiguously-qualifie_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_check-engine', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_check-engine_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_dad-bod-dynasty', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_dad-bod-dynasty_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_fullertons-old-schoo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_fullertons-old-schoo_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_good', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_good_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_irish-wristwatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_irish-wristwatch_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_obsolete', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_obsolete_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_red', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_red_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmint_thruster-i-hardly-kn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmint_thruster-i-hardly-kn_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Masters Men's - Intermediate
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mmint_ambiguously-qualifie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_ambiguously-qualifie_1', 'tmem_evt_mmint_ambiguously-qualifie_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Ambiguously Qualified CrossFit Duo', 'user_mmint_ambiguously-qualifie_1', 'team_mmint_ambiguously-qualifie', 'cpur_mmint_ambiguously-qualifie', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_check-engine', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_check-engine_1', 'tmem_evt_mmint_check-engine_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Check Engine', 'user_mmint_check-engine_1', 'team_mmint_check-engine', 'cpur_mmint_check-engine', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_dad-bod-dynasty', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_dad-bod-dynasty_1', 'tmem_evt_mmint_dad-bod-dynasty_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Dad Bod Dynasty', 'user_mmint_dad-bod-dynasty_1', 'team_mmint_dad-bod-dynasty', 'cpur_mmint_dad-bod-dynasty', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_fullertons-old-schoo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_fullertons-old-schoo_1', 'tmem_evt_mmint_fullertons-old-schoo_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Fullerton''s Old School', 'user_mmint_fullertons-old-schoo_1', 'team_mmint_fullertons-old-schoo', 'cpur_mmint_fullertons-old-schoo', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_good', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_good_1', 'tmem_evt_mmint_good_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'GOOD', 'user_mmint_good_1', 'team_mmint_good', 'cpur_mmint_good', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_irish-wristwatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_irish-wristwatch_1', 'tmem_evt_mmint_irish-wristwatch_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Irish Wristwatch', 'user_mmint_irish-wristwatch_1', 'team_mmint_irish-wristwatch', 'cpur_mmint_irish-wristwatch', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_obsolete', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_obsolete_1', 'tmem_evt_mmint_obsolete_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'OBSOLETE', 'user_mmint_obsolete_1', 'team_mmint_obsolete', 'cpur_mmint_obsolete', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_red', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_red_1', 'tmem_evt_mmint_red_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Red', 'user_mmint_red_1', 'team_mmint_red', 'cpur_mmint_red', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmint_thruster-i-hardly-kn', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmint_thruster-i-hardly-kn_1', 'tmem_evt_mmint_thruster-i-hardly-kn_1', 'slvl_mwfc_masters_mens_int', strftime('%s', '2025-08-01'), 'Thruster? I hardly know her', 'user_mmint_thruster-i-hardly-kn_1', 'team_mmint_thruster-i-hardly-kn', 'cpur_mmint_thruster-i-hardly-kn', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MASTERS MEN'S - ROOKIE
-- Division ID: slvl_mwfc_masters_mens_rookie (Competition Corner: 104742)
-- 5 teams
-- ============================================

-- Users for Masters Men's - Rookie
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mmrook_worst-pace-scenario_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Adam', 'Huddleston', 'worst-pace-scenario.1@example.com', '', 1),
  ('user_mmrook_worst-pace-scenario_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mike', 'Barley', 'worst-pace-scenario.2@example.com', '', 1),
  ('user_mmrook_mexican-jumping-bean_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'David', 'Miranda', 'mexican-jumping-bean.1@example.com', '', 1),
  ('user_mmrook_mexican-jumping-bean_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Frankie', 'Soto', 'mexican-jumping-bean.2@example.com', '', 1),
  ('user_mmrook_peaked-in-high-schoo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ryan', 'Nelson', 'peaked-in-high-schoo.1@example.com', '', 1),
  ('user_mmrook_peaked-in-high-schoo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Colin', 'Hickman', 'peaked-in-high-schoo.2@example.com', '', 1),
  ('user_mmrook_team-puma-sock_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Buell', 'Gonzales', 'team-puma-sock.1@example.com', '', 1),
  ('user_mmrook_team-puma-sock_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Luke', 'Hearne', 'team-puma-sock.2@example.com', '', 1),
  ('user_mmrook_two-guys-big-thighs_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Bill', 'Gardiner', 'two-guys-big-thighs.1@example.com', '', 1),
  ('user_mmrook_two-guys-big-thighs_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Stephen', 'Warren', 'two-guys-big-thighs.2@example.com', '', 1);

-- Athlete Teams for Masters Men's - Rookie
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mmrook_worst-pace-scenario', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Worst Pace Scenario', 'worst-pace-scenario', 'athlete', NULL),
  ('team_mmrook_mexican-jumping-bean', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mexican Jumping BEANS', 'mexican-jumping-bean', 'athlete', NULL),
  ('team_mmrook_peaked-in-high-schoo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Peaked in High School', 'peaked-in-high-schoo', 'athlete', NULL),
  ('team_mmrook_team-puma-sock', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Team Puma Sock', 'team-puma-sock', 'athlete', NULL),
  ('team_mmrook_two-guys-big-thighs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Two Guys-Big Thighs', 'two-guys-big-thighs', 'athlete', NULL);

-- Team Memberships for Masters Men's - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mmrook_worst-pace-scenario_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_worst-pace-scenario', 'user_mmrook_worst-pace-scenario_1', 'admin', 1),
  ('tm_mmrook_worst-pace-scenario_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_worst-pace-scenario', 'user_mmrook_worst-pace-scenario_2', 'member', 1),
  ('tm_mmrook_mexican-jumping-bean_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_mexican-jumping-bean', 'user_mmrook_mexican-jumping-bean_1', 'admin', 1),
  ('tm_mmrook_mexican-jumping-bean_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_mexican-jumping-bean', 'user_mmrook_mexican-jumping-bean_2', 'member', 1),
  ('tm_mmrook_peaked-in-high-schoo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_peaked-in-high-schoo', 'user_mmrook_peaked-in-high-schoo_1', 'admin', 1),
  ('tm_mmrook_peaked-in-high-schoo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_peaked-in-high-schoo', 'user_mmrook_peaked-in-high-schoo_2', 'member', 1),
  ('tm_mmrook_team-puma-sock_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_team-puma-sock', 'user_mmrook_team-puma-sock_1', 'admin', 1),
  ('tm_mmrook_team-puma-sock_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_team-puma-sock', 'user_mmrook_team-puma-sock_2', 'member', 1),
  ('tm_mmrook_two-guys-big-thighs_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_two-guys-big-thighs', 'user_mmrook_two-guys-big-thighs_1', 'admin', 1),
  ('tm_mmrook_two-guys-big-thighs_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mmrook_two-guys-big-thighs', 'user_mmrook_two-guys-big-thighs_2', 'member', 1);

-- Event Team Memberships for Masters Men's - Rookie
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mmrook_worst-pace-scenario_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_worst-pace-scenario_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_worst-pace-scenario_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_worst-pace-scenario_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_mexican-jumping-bean_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_mexican-jumping-bean_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_mexican-jumping-bean_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_mexican-jumping-bean_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_peaked-in-high-schoo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_peaked-in-high-schoo_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_peaked-in-high-schoo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_peaked-in-high-schoo_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_team-puma-sock_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_team-puma-sock_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_team-puma-sock_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_team-puma-sock_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_two-guys-big-thighs_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_two-guys-big-thighs_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mmrook_two-guys-big-thighs_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mmrook_two-guys-big-thighs_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Masters Men's - Rookie ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mmrook_worst-pace-scenario', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrook_worst-pace-scenario_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrook_mexican-jumping-bean', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrook_mexican-jumping-bean_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrook_peaked-in-high-schoo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrook_peaked-in-high-schoo_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrook_team-puma-sock', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrook_team-puma-sock_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mmrook_two-guys-big-thighs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mmrook_two-guys-big-thighs_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rookie', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Masters Men's - Rookie
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mmrook_worst-pace-scenario', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrook_worst-pace-scenario_1', 'tmem_evt_mmrook_worst-pace-scenario_1', 'slvl_mwfc_masters_mens_rookie', strftime('%s', '2025-08-01'), 'Worst Pace Scenario', 'user_mmrook_worst-pace-scenario_1', 'team_mmrook_worst-pace-scenario', 'cpur_mmrook_worst-pace-scenario', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrook_mexican-jumping-bean', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrook_mexican-jumping-bean_1', 'tmem_evt_mmrook_mexican-jumping-bean_1', 'slvl_mwfc_masters_mens_rookie', strftime('%s', '2025-08-01'), 'Mexican Jumping BEANS', 'user_mmrook_mexican-jumping-bean_1', 'team_mmrook_mexican-jumping-bean', 'cpur_mmrook_mexican-jumping-bean', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrook_peaked-in-high-schoo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrook_peaked-in-high-schoo_1', 'tmem_evt_mmrook_peaked-in-high-schoo_1', 'slvl_mwfc_masters_mens_rookie', strftime('%s', '2025-08-01'), 'Peaked in High School', 'user_mmrook_peaked-in-high-schoo_1', 'team_mmrook_peaked-in-high-schoo', 'cpur_mmrook_peaked-in-high-schoo', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrook_team-puma-sock', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrook_team-puma-sock_1', 'tmem_evt_mmrook_team-puma-sock_1', 'slvl_mwfc_masters_mens_rookie', strftime('%s', '2025-08-01'), 'Team Puma Sock', 'user_mmrook_team-puma-sock_1', 'team_mmrook_team-puma-sock', 'cpur_mmrook_team-puma-sock', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mmrook_two-guys-big-thighs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mmrook_two-guys-big-thighs_1', 'tmem_evt_mmrook_two-guys-big-thighs_1', 'slvl_mwfc_masters_mens_rookie', strftime('%s', '2025-08-01'), 'Two Guys-Big Thighs', 'user_mmrook_two-guys-big-thighs_1', 'team_mmrook_two-guys-big-thighs', 'cpur_mmrook_two-guys-big-thighs', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MASTERS WOMEN'S - INTERMEDIATE
-- Division ID: slvl_mwfc_masters_womens_int (Competition Corner: 104744)
-- 9 teams
-- ============================================

-- Users for Masters Women's - Intermediate
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mwint_10-kids-later_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jaime', 'Williams', '10-kids-later.1@example.com', '', 1),
  ('user_mwint_10-kids-later_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Blair', 'Thompson', '10-kids-later.2@example.com', '', 1),
  ('user_mwint_apple-bottom-cleans_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kira', 'Bousquet', 'apple-bottom-cleans.1@example.com', '', 1),
  ('user_mwint_apple-bottom-cleans_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Leona', 'Sandoval', 'apple-bottom-cleans.2@example.com', '', 1),
  ('user_mwint_barbell-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Whitney', 'Voigt', 'barbell-bros.1@example.com', '', 1),
  ('user_mwint_barbell-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Christen', 'Mccool', 'barbell-bros.2@example.com', '', 1),
  ('user_mwint_built-in-black_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Danielle', 'Stumpf', 'built-in-black.1@example.com', '', 1),
  ('user_mwint_built-in-black_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jessica', 'Perttula', 'built-in-black.2@example.com', '', 1),
  ('user_mwint_captain-baby_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sonya', 'Chamberlain', 'captain-baby.1@example.com', '', 1),
  ('user_mwint_captain-baby_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Stephanie', 'Karins', 'captain-baby.2@example.com', '', 1),
  ('user_mwint_gen-x-flex_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Amy', 'Hill', 'gen-x-flex.1@example.com', '', 1),
  ('user_mwint_gen-x-flex_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Hyla', 'Ridenour', 'gen-x-flex.2@example.com', '', 1),
  ('user_mwint_iron-valkyrie-sister_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Michaele', 'Lien', 'iron-valkyrie-sister.1@example.com', '', 1),
  ('user_mwint_iron-valkyrie-sister_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Steph', 'Nyhof', 'iron-valkyrie-sister.2@example.com', '', 1),
  ('user_mwint_not-fast-just-furiou_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Melissa', 'Avery', 'not-fast-just-furiou.1@example.com', '', 1),
  ('user_mwint_not-fast-just-furiou_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Katie', 'Inserra', 'not-fast-just-furiou.2@example.com', '', 1),
  ('user_mwint_slay-all-day_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Ashley', 'Morrison', 'slay-all-day.1@example.com', '', 1),
  ('user_mwint_slay-all-day_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Melissa', 'Curnutt', 'slay-all-day.2@example.com', '', 1);

-- Athlete Teams for Masters Women's - Intermediate
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mwint_10-kids-later', strftime('%s', 'now'), strftime('%s', 'now'), 1, '10 Kids Later...', '10-kids-later', 'athlete', NULL),
  ('team_mwint_apple-bottom-cleans', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Apple Bottom Cleans', 'apple-bottom-cleans', 'athlete', NULL),
  ('team_mwint_barbell-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Barbell Bros', 'barbell-bros', 'athlete', NULL),
  ('team_mwint_built-in-black', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Built in Black', 'built-in-black', 'athlete', NULL),
  ('team_mwint_captain-baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Captain Baby', 'captain-baby', 'athlete', NULL),
  ('team_mwint_gen-x-flex', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Gen X Flex', 'gen-x-flex', 'athlete', NULL),
  ('team_mwint_iron-valkyrie-sister', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Iron Valkyrie Sisters', 'iron-valkyrie-sister', 'athlete', NULL),
  ('team_mwint_not-fast-just-furiou', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Not Fast Just Furious', 'not-fast-just-furiou', 'athlete', NULL),
  ('team_mwint_slay-all-day', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Slay All Day', 'slay-all-day', 'athlete', NULL);

-- Team Memberships for Masters Women's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mwint_10-kids-later_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_10-kids-later', 'user_mwint_10-kids-later_1', 'admin', 1),
  ('tm_mwint_10-kids-later_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_10-kids-later', 'user_mwint_10-kids-later_2', 'member', 1),
  ('tm_mwint_apple-bottom-cleans_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_apple-bottom-cleans', 'user_mwint_apple-bottom-cleans_1', 'admin', 1),
  ('tm_mwint_apple-bottom-cleans_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_apple-bottom-cleans', 'user_mwint_apple-bottom-cleans_2', 'member', 1),
  ('tm_mwint_barbell-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_barbell-bros', 'user_mwint_barbell-bros_1', 'admin', 1),
  ('tm_mwint_barbell-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_barbell-bros', 'user_mwint_barbell-bros_2', 'member', 1),
  ('tm_mwint_built-in-black_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_built-in-black', 'user_mwint_built-in-black_1', 'admin', 1),
  ('tm_mwint_built-in-black_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_built-in-black', 'user_mwint_built-in-black_2', 'member', 1),
  ('tm_mwint_captain-baby_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_captain-baby', 'user_mwint_captain-baby_1', 'admin', 1),
  ('tm_mwint_captain-baby_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_captain-baby', 'user_mwint_captain-baby_2', 'member', 1),
  ('tm_mwint_gen-x-flex_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_gen-x-flex', 'user_mwint_gen-x-flex_1', 'admin', 1),
  ('tm_mwint_gen-x-flex_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_gen-x-flex', 'user_mwint_gen-x-flex_2', 'member', 1),
  ('tm_mwint_iron-valkyrie-sister_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_iron-valkyrie-sister', 'user_mwint_iron-valkyrie-sister_1', 'admin', 1),
  ('tm_mwint_iron-valkyrie-sister_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_iron-valkyrie-sister', 'user_mwint_iron-valkyrie-sister_2', 'member', 1),
  ('tm_mwint_not-fast-just-furiou_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_not-fast-just-furiou', 'user_mwint_not-fast-just-furiou_1', 'admin', 1),
  ('tm_mwint_not-fast-just-furiou_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_not-fast-just-furiou', 'user_mwint_not-fast-just-furiou_2', 'member', 1),
  ('tm_mwint_slay-all-day_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_slay-all-day', 'user_mwint_slay-all-day_1', 'admin', 1),
  ('tm_mwint_slay-all-day_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwint_slay-all-day', 'user_mwint_slay-all-day_2', 'member', 1);

-- Event Team Memberships for Masters Women's - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mwint_10-kids-later_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_10-kids-later_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_10-kids-later_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_10-kids-later_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_apple-bottom-cleans_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_apple-bottom-cleans_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_apple-bottom-cleans_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_apple-bottom-cleans_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_barbell-bros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_barbell-bros_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_barbell-bros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_barbell-bros_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_built-in-black_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_built-in-black_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_built-in-black_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_built-in-black_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_captain-baby_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_captain-baby_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_captain-baby_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_captain-baby_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_gen-x-flex_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_gen-x-flex_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_gen-x-flex_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_gen-x-flex_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_iron-valkyrie-sister_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_iron-valkyrie-sister_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_iron-valkyrie-sister_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_iron-valkyrie-sister_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_not-fast-just-furiou_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_not-fast-just-furiou_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_not-fast-just-furiou_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_not-fast-just-furiou_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_slay-all-day_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_slay-all-day_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mwint_slay-all-day_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mwint_slay-all-day_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Masters Women's - Intermediate ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mwint_10-kids-later', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_10-kids-later_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_apple-bottom-cleans', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_apple-bottom-cleans_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_barbell-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_barbell-bros_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_built-in-black', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_built-in-black_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_captain-baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_captain-baby_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_gen-x-flex', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_gen-x-flex_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_iron-valkyrie-sister', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_iron-valkyrie-sister_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_not-fast-just-furiou', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_not-fast-just-furiou_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mwint_slay-all-day', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mwint_slay-all-day_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Masters Women's - Intermediate
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mwint_10-kids-later', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_10-kids-later_1', 'tmem_evt_mwint_10-kids-later_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), '10 Kids Later...', 'user_mwint_10-kids-later_1', 'team_mwint_10-kids-later', 'cpur_mwint_10-kids-later', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_apple-bottom-cleans', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_apple-bottom-cleans_1', 'tmem_evt_mwint_apple-bottom-cleans_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Apple Bottom Cleans', 'user_mwint_apple-bottom-cleans_1', 'team_mwint_apple-bottom-cleans', 'cpur_mwint_apple-bottom-cleans', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_barbell-bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_barbell-bros_1', 'tmem_evt_mwint_barbell-bros_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Barbell Bros', 'user_mwint_barbell-bros_1', 'team_mwint_barbell-bros', 'cpur_mwint_barbell-bros', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_built-in-black', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_built-in-black_1', 'tmem_evt_mwint_built-in-black_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Built in Black', 'user_mwint_built-in-black_1', 'team_mwint_built-in-black', 'cpur_mwint_built-in-black', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_captain-baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_captain-baby_1', 'tmem_evt_mwint_captain-baby_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Captain Baby', 'user_mwint_captain-baby_1', 'team_mwint_captain-baby', 'cpur_mwint_captain-baby', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_gen-x-flex', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_gen-x-flex_1', 'tmem_evt_mwint_gen-x-flex_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Gen X Flex', 'user_mwint_gen-x-flex_1', 'team_mwint_gen-x-flex', 'cpur_mwint_gen-x-flex', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_iron-valkyrie-sister', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_iron-valkyrie-sister_1', 'tmem_evt_mwint_iron-valkyrie-sister_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Iron Valkyrie Sisters', 'user_mwint_iron-valkyrie-sister_1', 'team_mwint_iron-valkyrie-sister', 'cpur_mwint_iron-valkyrie-sister', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_not-fast-just-furiou', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_not-fast-just-furiou_1', 'tmem_evt_mwint_not-fast-just-furiou_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Not Fast Just Furious', 'user_mwint_not-fast-just-furiou_1', 'team_mwint_not-fast-just-furiou', 'cpur_mwint_not-fast-just-furiou', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mwint_slay-all-day', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mwint_slay-all-day_1', 'tmem_evt_mwint_slay-all-day_1', 'slvl_mwfc_masters_womens_int', strftime('%s', '2025-08-01'), 'Slay All Day', 'user_mwint_slay-all-day_1', 'team_mwint_slay-all-day', 'cpur_mwint_slay-all-day', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MASTERS CO-ED - RX
-- Division ID: slvl_mwfc_masters_coed_rx (Competition Corner: 106123)
-- 4 teams
-- ============================================

-- Users for Masters Co-Ed - RX
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mcrx_aged-to-perfection_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Rebekah', 'Rand', 'aged-to-perfection.1@example.com', '', 1),
  ('user_mcrx_aged-to-perfection_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Josh', 'Hunt', 'aged-to-perfection.2@example.com', '', 1),
  ('user_mcrx_hgr-cbd-athletics_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Carl', 'Kaplan', 'hgr-cbd-athletics.1@example.com', '', 1),
  ('user_mcrx_hgr-cbd-athletics_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Tiara', 'Bowman', 'hgr-cbd-athletics.2@example.com', '', 1),
  ('user_mcrx_nooners_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Anthony', 'Mattucci', 'nooners.1@example.com', '', 1),
  ('user_mcrx_nooners_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mary', 'Bennett', 'nooners.2@example.com', '', 1),
  ('user_mcrx_sigma-and-gyat_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Dani', 'Miller', 'sigma-and-gyat.1@example.com', '', 1),
  ('user_mcrx_sigma-and-gyat_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Eric', 'Smith', 'sigma-and-gyat.2@example.com', '', 1);

-- Athlete Teams for Masters Co-Ed - RX
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mcrx_aged-to-perfection', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Aged to Perfection', 'aged-to-perfection', 'athlete', NULL),
  ('team_mcrx_hgr-cbd-athletics', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'HGR CBD Athletics', 'hgr-cbd-athletics', 'athlete', NULL),
  ('team_mcrx_nooners', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Nooners', 'nooners', 'athlete', NULL),
  ('team_mcrx_sigma-and-gyat', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sigma and Gyat', 'sigma-and-gyat', 'athlete', NULL);

-- Team Memberships for Masters Co-Ed - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mcrx_aged-to-perfection_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_aged-to-perfection', 'user_mcrx_aged-to-perfection_1', 'admin', 1),
  ('tm_mcrx_aged-to-perfection_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_aged-to-perfection', 'user_mcrx_aged-to-perfection_2', 'member', 1),
  ('tm_mcrx_hgr-cbd-athletics_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_hgr-cbd-athletics', 'user_mcrx_hgr-cbd-athletics_1', 'admin', 1),
  ('tm_mcrx_hgr-cbd-athletics_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_hgr-cbd-athletics', 'user_mcrx_hgr-cbd-athletics_2', 'member', 1),
  ('tm_mcrx_nooners_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_nooners', 'user_mcrx_nooners_1', 'admin', 1),
  ('tm_mcrx_nooners_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_nooners', 'user_mcrx_nooners_2', 'member', 1),
  ('tm_mcrx_sigma-and-gyat_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_sigma-and-gyat', 'user_mcrx_sigma-and-gyat_1', 'admin', 1),
  ('tm_mcrx_sigma-and-gyat_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcrx_sigma-and-gyat', 'user_mcrx_sigma-and-gyat_2', 'member', 1);

-- Event Team Memberships for Masters Co-Ed - RX
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mcrx_aged-to-perfection_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_aged-to-perfection_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_aged-to-perfection_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_aged-to-perfection_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_hgr-cbd-athletics_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_hgr-cbd-athletics_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_hgr-cbd-athletics_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_hgr-cbd-athletics_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_nooners_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_nooners_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_nooners_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_nooners_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_sigma-and-gyat_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_sigma-and-gyat_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcrx_sigma-and-gyat_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcrx_sigma-and-gyat_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Masters Co-Ed - RX ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mcrx_aged-to-perfection', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcrx_aged-to-perfection_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcrx_hgr-cbd-athletics', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcrx_hgr-cbd-athletics_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcrx_nooners', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcrx_nooners_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcrx_sigma-and-gyat', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcrx_sigma-and-gyat_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Masters Co-Ed - RX
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mcrx_aged-to-perfection', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcrx_aged-to-perfection_1', 'tmem_evt_mcrx_aged-to-perfection_1', 'slvl_mwfc_masters_coed_rx', strftime('%s', '2025-08-01'), 'Aged to Perfection', 'user_mcrx_aged-to-perfection_1', 'team_mcrx_aged-to-perfection', 'cpur_mcrx_aged-to-perfection', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcrx_hgr-cbd-athletics', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcrx_hgr-cbd-athletics_1', 'tmem_evt_mcrx_hgr-cbd-athletics_1', 'slvl_mwfc_masters_coed_rx', strftime('%s', '2025-08-01'), 'HGR CBD Athletics', 'user_mcrx_hgr-cbd-athletics_1', 'team_mcrx_hgr-cbd-athletics', 'cpur_mcrx_hgr-cbd-athletics', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcrx_nooners', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcrx_nooners_1', 'tmem_evt_mcrx_nooners_1', 'slvl_mwfc_masters_coed_rx', strftime('%s', '2025-08-01'), 'Nooners', 'user_mcrx_nooners_1', 'team_mcrx_nooners', 'cpur_mcrx_nooners', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcrx_sigma-and-gyat', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcrx_sigma-and-gyat_1', 'tmem_evt_mcrx_sigma-and-gyat_1', 'slvl_mwfc_masters_coed_rx', strftime('%s', '2025-08-01'), 'Sigma and Gyat', 'user_mcrx_sigma-and-gyat_1', 'team_mcrx_sigma-and-gyat', 'cpur_mcrx_sigma-and-gyat', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- MASTERS CO-ED - INTERMEDIATE
-- Division ID: slvl_mwfc_masters_coed_int (Competition Corner: 106124)
-- 6 teams
-- ============================================

-- Users for Masters Co-Ed - Intermediate
INSERT OR REPLACE INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
  ('user_mcint_blue-eyed-beasts_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Joe', 'Busick', 'blue-eyed-beasts.1@example.com', '', 1),
  ('user_mcint_blue-eyed-beasts_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'BEKKIE', 'RITCHIE', 'blue-eyed-beasts.2@example.com', '', 1),
  ('user_mcint_i-ve-got-a-headache_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Andrew', 'Watkins', 'i-ve-got-a-headache.1@example.com', '', 1),
  ('user_mcint_i-ve-got-a-headache_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Kacy', 'Watkins', 'i-ve-got-a-headache.2@example.com', '', 1),
  ('user_mcint_plus-ultra_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Sharee', 'Hibbard', 'plus-ultra.1@example.com', '', 1),
  ('user_mcint_plus-ultra_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Jacob', 'Hibbard', 'plus-ultra.2@example.com', '', 1),
  ('user_mcint_squat-me-baby_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Travis', 'Smith', 'squat-me-baby.1@example.com', '', 1),
  ('user_mcint_squat-me-baby_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Erin', 'Smith', 'squat-me-baby.2@example.com', '', 1),
  ('user_mcint_team-nancy-resting-b_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Mary', 'Johnson', 'team-nancy-resting-b.1@example.com', '', 1),
  ('user_mcint_team-nancy-resting-b_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Eric', 'Belnap', 'team-nancy-resting-b.2@example.com', '', 1),
  ('user_mcint_the-zzzs_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Maxwell', 'Zamzow', 'the-zzzs.1@example.com', '', 1),
  ('user_mcint_the-zzzs_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Christina', 'Zier', 'the-zzzs.2@example.com', '', 1);

-- Athlete Teams for Masters Co-Ed - Intermediate
INSERT OR REPLACE INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mcint_blue-eyed-beasts', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Blue Eyed Beasts', 'blue-eyed-beasts', 'athlete', NULL),
  ('team_mcint_i-ve-got-a-headache', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'I’ve got a headache', 'i-ve-got-a-headache', 'athlete', NULL),
  ('team_mcint_plus-ultra', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Plus Ultra', 'plus-ultra', 'athlete', NULL),
  ('team_mcint_squat-me-baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Squat me baby!!', 'squat-me-baby', 'athlete', NULL),
  ('team_mcint_team-nancy-resting-b', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Team Nancy/Resting Belnap Face (RBF)', 'team-nancy-resting-b', 'athlete', NULL),
  ('team_mcint_the-zzzs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Zzz''s', 'the-zzzs', 'athlete', NULL);

-- Team Memberships for Masters Co-Ed - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  ('tm_mcint_blue-eyed-beasts_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_blue-eyed-beasts', 'user_mcint_blue-eyed-beasts_1', 'admin', 1),
  ('tm_mcint_blue-eyed-beasts_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_blue-eyed-beasts', 'user_mcint_blue-eyed-beasts_2', 'member', 1),
  ('tm_mcint_i-ve-got-a-headache_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_i-ve-got-a-headache', 'user_mcint_i-ve-got-a-headache_1', 'admin', 1),
  ('tm_mcint_i-ve-got-a-headache_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_i-ve-got-a-headache', 'user_mcint_i-ve-got-a-headache_2', 'member', 1),
  ('tm_mcint_plus-ultra_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_plus-ultra', 'user_mcint_plus-ultra_1', 'admin', 1),
  ('tm_mcint_plus-ultra_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_plus-ultra', 'user_mcint_plus-ultra_2', 'member', 1),
  ('tm_mcint_squat-me-baby_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_squat-me-baby', 'user_mcint_squat-me-baby_1', 'admin', 1),
  ('tm_mcint_squat-me-baby_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_squat-me-baby', 'user_mcint_squat-me-baby_2', 'member', 1),
  ('tm_mcint_team-nancy-resting-b_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_team-nancy-resting-b', 'user_mcint_team-nancy-resting-b_1', 'admin', 1),
  ('tm_mcint_team-nancy-resting-b_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_team-nancy-resting-b', 'user_mcint_team-nancy-resting-b_2', 'member', 1),
  ('tm_mcint_the-zzzs_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_the-zzzs', 'user_mcint_the-zzzs_1', 'admin', 1),
  ('tm_mcint_the-zzzs_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mcint_the-zzzs', 'user_mcint_the-zzzs_2', 'member', 1);

-- Event Team Memberships for Masters Co-Ed - Intermediate
INSERT OR REPLACE INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_evt_mcint_blue-eyed-beasts_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_blue-eyed-beasts_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_blue-eyed-beasts_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_blue-eyed-beasts_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_i-ve-got-a-headache_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_i-ve-got-a-headache_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_i-ve-got-a-headache_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_i-ve-got-a-headache_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_plus-ultra_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_plus-ultra_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_plus-ultra_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_plus-ultra_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_squat-me-baby_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_squat-me-baby_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_squat-me-baby_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_squat-me-baby_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_team-nancy-resting-b_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_team-nancy-resting-b_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_team-nancy-resting-b_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_team-nancy-resting-b_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_the-zzzs_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_the-zzzs_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_evt_mcint_the-zzzs_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mcint_the-zzzs_2', 'member', 1, strftime('%s', '2025-08-01'));

-- Commerce Purchases for Masters Co-Ed - Intermediate ($350 = 35000 cents)
INSERT OR REPLACE INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mcint_blue-eyed-beasts', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcint_blue-eyed-beasts_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcint_i-ve-got-a-headache', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcint_i-ve-got-a-headache_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcint_plus-ultra', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcint_plus-ultra_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcint_squat-me-baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcint_squat-me-baby_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcint_team-nancy-resting-b', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcint_team-nancy-resting-b_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mcint_the-zzzs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mcint_the-zzzs_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- Competition Registrations for Masters Co-Ed - Intermediate
INSERT OR REPLACE INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mcint_blue-eyed-beasts', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcint_blue-eyed-beasts_1', 'tmem_evt_mcint_blue-eyed-beasts_1', 'slvl_mwfc_masters_coed_int', strftime('%s', '2025-08-01'), 'Blue Eyed Beasts', 'user_mcint_blue-eyed-beasts_1', 'team_mcint_blue-eyed-beasts', 'cpur_mcint_blue-eyed-beasts', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcint_i-ve-got-a-headache', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcint_i-ve-got-a-headache_1', 'tmem_evt_mcint_i-ve-got-a-headache_1', 'slvl_mwfc_masters_coed_int', strftime('%s', '2025-08-01'), 'I’ve got a headache', 'user_mcint_i-ve-got-a-headache_1', 'team_mcint_i-ve-got-a-headache', 'cpur_mcint_i-ve-got-a-headache', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcint_plus-ultra', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcint_plus-ultra_1', 'tmem_evt_mcint_plus-ultra_1', 'slvl_mwfc_masters_coed_int', strftime('%s', '2025-08-01'), 'Plus Ultra', 'user_mcint_plus-ultra_1', 'team_mcint_plus-ultra', 'cpur_mcint_plus-ultra', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcint_squat-me-baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcint_squat-me-baby_1', 'tmem_evt_mcint_squat-me-baby_1', 'slvl_mwfc_masters_coed_int', strftime('%s', '2025-08-01'), 'Squat me baby!!', 'user_mcint_squat-me-baby_1', 'team_mcint_squat-me-baby', 'cpur_mcint_squat-me-baby', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcint_team-nancy-resting-b', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcint_team-nancy-resting-b_1', 'tmem_evt_mcint_team-nancy-resting-b_1', 'slvl_mwfc_masters_coed_int', strftime('%s', '2025-08-01'), 'Team Nancy/Resting Belnap Face (RBF)', 'user_mcint_team-nancy-resting-b_1', 'team_mcint_team-nancy-resting-b', 'cpur_mcint_team-nancy-resting-b', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mcint_the-zzzs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mcint_the-zzzs_1', 'tmem_evt_mcint_the-zzzs_1', 'slvl_mwfc_masters_coed_int', strftime('%s', '2025-08-01'), 'The Zzz''s', 'user_mcint_the-zzzs_1', 'team_mcint_the-zzzs', 'cpur_mcint_the-zzzs', 'PAID', strftime('%s', '2025-08-01'));

-- ============================================
-- COMPETITION HEATS (All Divisions except Men's RX)
-- ============================================

-- Workout 1 Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_w1_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-10 09:00:00'), 15, 'slvl_mwfc_coed_rookie', 'Co-Ed - Rookie + Masters Co-Ed - Intermediate'),
  ('cheat_w1_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-10 09:18:00'), 15, 'slvl_mwfc_coed_rx', 'Co-Ed - RX'),
  ('cheat_w1_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-10 09:36:00'), 15, 'slvl_mwfc_masters_coed_rx', 'Masters Co-Ed - RX + Co-Ed - Intermediate'),
  ('cheat_w1_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-10 09:54:00'), 15, 'slvl_mwfc_coed_int', 'Co-Ed - Intermediate + Masters Men''s - Intermediate'),
  ('cheat_w1_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-10 10:12:00'), 15, 'slvl_mwfc_masters_womens_int', 'Masters Women''s - Intermediate + Masters Men''s - Rookie'),
  ('cheat_w1_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-10 10:30:00'), 15, 'slvl_mwfc_masters_mens_rx', 'Masters Men''s - RX'),
  ('cheat_w1_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-10 11:06:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate'),
  ('cheat_w1_h9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 9, strftime('%s', '2025-10-10 11:24:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate + Men''s - Rookie'),
  ('cheat_w1_h10', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 10, strftime('%s', '2025-10-10 11:42:00'), 15, 'slvl_mwfc_womens_rookie', 'Women''s - Rookie'),
  ('cheat_w1_h11', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 11, strftime('%s', '2025-10-10 12:00:00'), 15, 'slvl_mwfc_womens_int', 'Women''s - Intermediate'),
  ('cheat_w1_h12', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 12, strftime('%s', '2025-10-10 12:18:00'), 15, 'slvl_mwfc_womens_rx', 'Women''s - RX');

-- Workout 2 Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_w2_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-10 13:06:00'), 15, 'slvl_mwfc_coed_rookie', 'Co-Ed - Rookie + Masters Co-Ed - Intermediate'),
  ('cheat_w2_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-10 13:21:00'), 15, 'slvl_mwfc_coed_rx', 'Co-Ed - RX'),
  ('cheat_w2_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-10 13:36:00'), 15, 'slvl_mwfc_masters_coed_rx', 'Masters Co-Ed - RX + Co-Ed - Intermediate'),
  ('cheat_w2_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-10 13:51:00'), 15, 'slvl_mwfc_coed_int', 'Co-Ed - Intermediate + Masters Men''s - Intermediate'),
  ('cheat_w2_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-10 14:06:00'), 15, 'slvl_mwfc_masters_womens_int', 'Masters Women''s - Intermediate + Masters Men''s - Rookie'),
  ('cheat_w2_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-10 14:21:00'), 15, 'slvl_mwfc_masters_mens_rx', 'Masters Men''s - RX'),
  ('cheat_w2_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-10 14:51:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate'),
  ('cheat_w2_h9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 9, strftime('%s', '2025-10-10 15:06:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate + Men''s - Rookie'),
  ('cheat_w2_h10', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 10, strftime('%s', '2025-10-10 15:21:00'), 15, 'slvl_mwfc_womens_rookie', 'Women''s - Rookie'),
  ('cheat_w2_h11', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 11, strftime('%s', '2025-10-10 15:36:00'), 15, 'slvl_mwfc_womens_int', 'Women''s - Intermediate'),
  ('cheat_w2_h12', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 12, strftime('%s', '2025-10-10 15:51:00'), 15, 'slvl_mwfc_womens_rx', 'Women''s - RX');

-- Workout 3 Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_w3_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-10 16:36:00'), 15, 'slvl_mwfc_coed_rookie', 'Co-Ed - Rookie + Masters Co-Ed - Intermediate'),
  ('cheat_w3_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-10 16:49:00'), 15, 'slvl_mwfc_coed_rx', 'Co-Ed - RX'),
  ('cheat_w3_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-10 17:02:00'), 15, 'slvl_mwfc_masters_coed_rx', 'Masters Co-Ed - RX + Co-Ed - Intermediate'),
  ('cheat_w3_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-10 17:15:00'), 15, 'slvl_mwfc_coed_int', 'Co-Ed - Intermediate + Masters Men''s - Intermediate'),
  ('cheat_w3_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-10 17:28:00'), 15, 'slvl_mwfc_masters_womens_int', 'Masters Women''s - Intermediate + Masters Men''s - Rookie'),
  ('cheat_w3_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-10 17:41:00'), 15, 'slvl_mwfc_masters_mens_rx', 'Masters Men''s - RX'),
  ('cheat_w3_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-10 18:07:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate'),
  ('cheat_w3_h9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 9, strftime('%s', '2025-10-10 18:20:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate + Men''s - Rookie'),
  ('cheat_w3_h10', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 10, strftime('%s', '2025-10-10 18:33:00'), 15, 'slvl_mwfc_womens_rookie', 'Women''s - Rookie'),
  ('cheat_w3_h11', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 11, strftime('%s', '2025-10-10 18:46:00'), 15, 'slvl_mwfc_womens_int', 'Women''s - Intermediate'),
  ('cheat_w3_h12', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 12, strftime('%s', '2025-10-10 18:59:00'), 15, 'slvl_mwfc_womens_rx', 'Women''s - RX');

-- Workout 4 Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_w4_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-11 08:30:00'), 15, 'slvl_mwfc_coed_rookie', 'Co-Ed - Rookie + Masters Co-Ed - Intermediate'),
  ('cheat_w4_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-11 08:43:00'), 15, 'slvl_mwfc_coed_rx', 'Co-Ed - RX'),
  ('cheat_w4_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-11 08:56:00'), 15, 'slvl_mwfc_masters_coed_rx', 'Masters Co-Ed - RX + Co-Ed - Intermediate'),
  ('cheat_w4_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-11 09:09:00'), 15, 'slvl_mwfc_coed_int', 'Co-Ed - Intermediate + Masters Men''s - Intermediate'),
  ('cheat_w4_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-11 09:22:00'), 15, 'slvl_mwfc_masters_womens_int', 'Masters Women''s - Intermediate + Masters Men''s - Rookie'),
  ('cheat_w4_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-11 09:35:00'), 15, 'slvl_mwfc_masters_mens_rx', 'Masters Men''s - RX'),
  ('cheat_w4_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-11 10:01:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate'),
  ('cheat_w4_h9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 9, strftime('%s', '2025-10-11 10:14:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate + Men''s - Rookie'),
  ('cheat_w4_h10', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 10, strftime('%s', '2025-10-11 10:27:00'), 15, 'slvl_mwfc_womens_rookie', 'Women''s - Rookie'),
  ('cheat_w4_h11', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 11, strftime('%s', '2025-10-11 10:40:00'), 15, 'slvl_mwfc_womens_int', 'Women''s - Intermediate'),
  ('cheat_w4_h12', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 12, strftime('%s', '2025-10-11 10:53:00'), 15, 'slvl_mwfc_womens_rx', 'Women''s - RX');

-- Workout 5 Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_w5_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-11 11:36:00'), 15, 'slvl_mwfc_coed_rookie', 'Co-Ed - Rookie + Masters Co-Ed - Intermediate'),
  ('cheat_w5_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-11 11:56:00'), 15, 'slvl_mwfc_coed_rx', 'Co-Ed - RX'),
  ('cheat_w5_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-11 12:16:00'), 15, 'slvl_mwfc_masters_coed_rx', 'Masters Co-Ed - RX + Co-Ed - Intermediate'),
  ('cheat_w5_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-11 12:36:00'), 15, 'slvl_mwfc_coed_int', 'Co-Ed - Intermediate + Masters Men''s - Intermediate'),
  ('cheat_w5_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-11 12:56:00'), 15, 'slvl_mwfc_masters_womens_int', 'Masters Women''s - Intermediate + Masters Men''s - Rookie'),
  ('cheat_w5_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-11 13:16:00'), 15, 'slvl_mwfc_masters_mens_rx', 'Masters Men''s - RX'),
  ('cheat_w5_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-11 13:56:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate'),
  ('cheat_w5_h9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 9, strftime('%s', '2025-10-11 14:16:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate + Men''s - Rookie'),
  ('cheat_w5_h10', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 10, strftime('%s', '2025-10-11 14:36:00'), 15, 'slvl_mwfc_womens_rookie', 'Women''s - Rookie'),
  ('cheat_w5_h11', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 11, strftime('%s', '2025-10-11 14:56:00'), 15, 'slvl_mwfc_womens_int', 'Women''s - Intermediate'),
  ('cheat_w5_h12', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 12, strftime('%s', '2025-10-11 15:16:00'), 15, 'slvl_mwfc_womens_rx', 'Women''s - RX');

-- Workout 6 Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_w6_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-11 16:06:00'), 15, 'slvl_mwfc_coed_rookie', 'Co-Ed - Rookie + Masters Co-Ed - Intermediate'),
  ('cheat_w6_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-11 16:21:00'), 15, 'slvl_mwfc_coed_rx', 'Co-Ed - RX'),
  ('cheat_w6_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-11 16:36:00'), 15, 'slvl_mwfc_masters_coed_rx', 'Masters Co-Ed - RX + Co-Ed - Intermediate'),
  ('cheat_w6_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-11 16:51:00'), 15, 'slvl_mwfc_coed_int', 'Co-Ed - Intermediate + Masters Men''s - Intermediate'),
  ('cheat_w6_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-11 17:06:00'), 15, 'slvl_mwfc_masters_womens_int', 'Masters Women''s - Intermediate + Masters Men''s - Rookie'),
  ('cheat_w6_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-11 17:21:00'), 15, 'slvl_mwfc_masters_mens_rx', 'Masters Men''s - RX'),
  ('cheat_w6_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-11 17:51:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate'),
  ('cheat_w6_h9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 9, strftime('%s', '2025-10-11 18:06:00'), 15, 'slvl_mwfc_mens_int', 'Men''s - Intermediate + Men''s - Rookie'),
  ('cheat_w6_h10', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 10, strftime('%s', '2025-10-11 18:21:00'), 15, 'slvl_mwfc_womens_rookie', 'Women''s - Rookie'),
  ('cheat_w6_h11', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 11, strftime('%s', '2025-10-11 18:36:00'), 15, 'slvl_mwfc_womens_int', 'Women''s - Intermediate'),
  ('cheat_w6_h12', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 12, strftime('%s', '2025-10-11 18:51:00'), 15, 'slvl_mwfc_womens_rx', 'Women''s - RX');

-- ============================================
-- COMPETITION HEAT ASSIGNMENTS
-- ============================================

-- Workout 1 Heat Assignments
INSERT OR REPLACE INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  ('cha_w1_h1_l1_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_breakfast-dinner', 1),
  ('cha_w1_h1_l2_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_cheez-it-extra-toast', 2),
  ('cha_w1_h1_l3_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_feel-the-mcburn', 3),
  ('cha_w1_h1_l4_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_fitz-and-furious', 4),
  ('cha_w1_h1_l5_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_geweck-yourselves', 5),
  ('cha_w1_h1_l6_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_let-em-cook', 6),
  ('cha_w1_h1_l7_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_richardson-rebels', 7),
  ('cha_w1_h1_l8_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_sin-miedo', 8),
  ('cha_w1_h1_l9_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_sore-losers', 9),
  ('cha_w1_h1_l10_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_crook_the-rex-factor', 10),
  ('cha_w1_h1_l11_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_mcint_blue-eyed-beasts', 11),
  ('cha_w1_h1_l12_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_mcint_i-ve-got-a-headache', 12),
  ('cha_w1_h1_l13_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_mcint_plus-ultra', 13),
  ('cha_w1_h1_l14_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_mcint_squat-me-baby', 14),
  ('cha_w1_h1_l15_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_mcint_team-nancy-resting-b', 15),
  ('cha_w1_h1_l16_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h1', 'creg_mcint_the-zzzs', 16),
  ('cha_w1_h2_l1_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_verdantside', 1),
  ('cha_w1_h2_l2_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_96-chicago-bulls', 2),
  ('cha_w1_h2_l3_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_ag-fan-club', 3),
  ('cha_w1_h2_l4_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_daddy-with-a-phatty', 4),
  ('cha_w1_h2_l5_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_em-and-m', 5),
  ('cha_w1_h2_l6_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_gcs-3', 6),
  ('cha_w1_h2_l7_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_goofy-goobers', 7),
  ('cha_w1_h2_l8_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_mules-of-co-pain', 8),
  ('cha_w1_h2_l9_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_queen-and-jerk', 9),
  ('cha_w1_h2_l10_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_rodeo-rhymers', 10),
  ('cha_w1_h2_l11_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_team-day-ones', 11),
  ('cha_w1_h2_l12_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_trident-athletics', 12),
  ('cha_w1_h2_l13_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h2', 'creg_crx_two-toned-thunder', 13),
  ('cha_w1_h3_l1_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_mcrx_aged-to-perfection', 1),
  ('cha_w1_h3_l2_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_mcrx_hgr-cbd-athletics', 2),
  ('cha_w1_h3_l3_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_mcrx_nooners', 3),
  ('cha_w1_h3_l4_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_mcrx_sigma-and-gyat', 4),
  ('cha_w1_h3_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_battle-born-and-worn', 5),
  ('cha_w1_h3_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_beat-boxers', 6),
  ('cha_w1_h3_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_bubba-needs-help', 7),
  ('cha_w1_h3_l8_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_cam-and-kenn', 8),
  ('cha_w1_h3_l9_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_deadlifts-chill', 9),
  ('cha_w1_h3_l10_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_dnr', 10),
  ('cha_w1_h3_l11_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_dos-chanchos', 11),
  ('cha_w1_h3_l12_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_grass-fed-grass-fini', 12),
  ('cha_w1_h3_l13_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_hustle-and-muscle', 13),
  ('cha_w1_h3_l14_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_misery-loves-company', 14),
  ('cha_w1_h3_l15_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_no-rep-no-whey', 15),
  ('cha_w1_h3_l16_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h3', 'creg_cint_row-mates-for-life', 16),
  ('cha_w1_h4_l1_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_swole-in-spirit', 1),
  ('cha_w1_h4_l2_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_swolemates', 2),
  ('cha_w1_h4_l3_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_the-frenchies', 3),
  ('cha_w1_h4_l4_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_thicc-and-tired', 4),
  ('cha_w1_h4_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_untaymable', 5),
  ('cha_w1_h4_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_what-would-froning-d', 6),
  ('cha_w1_h4_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_cint_wod-my-name-out-yo-m', 7),
  ('cha_w1_h4_l8_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_ambiguously-qualifie', 8),
  ('cha_w1_h4_l9_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_check-engine', 9),
  ('cha_w1_h4_l10_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_dad-bod-dynasty', 10),
  ('cha_w1_h4_l11_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_fullertons-old-schoo', 11),
  ('cha_w1_h4_l12_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_good', 12),
  ('cha_w1_h4_l13_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_irish-wristwatch', 13),
  ('cha_w1_h4_l14_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_obsolete', 14),
  ('cha_w1_h4_l15_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_red', 15),
  ('cha_w1_h4_l16_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h4', 'creg_mmint_thruster-i-hardly-kn', 16),
  ('cha_w1_h5_l1_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_10-kids-later', 1),
  ('cha_w1_h5_l2_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_apple-bottom-cleans', 2),
  ('cha_w1_h5_l3_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_barbell-bros', 3),
  ('cha_w1_h5_l4_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_built-in-black', 4),
  ('cha_w1_h5_l5_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_captain-baby', 5),
  ('cha_w1_h5_l6_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_gen-x-flex', 6),
  ('cha_w1_h5_l7_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_iron-valkyrie-sister', 7),
  ('cha_w1_h5_l8_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_not-fast-just-furiou', 8),
  ('cha_w1_h5_l9_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mwint_slay-all-day', 9),
  ('cha_w1_h5_l11_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mmrook_worst-pace-scenario', 11),
  ('cha_w1_h5_l12_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mmrook_mexican-jumping-bean', 12),
  ('cha_w1_h5_l13_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mmrook_peaked-in-high-schoo', 13),
  ('cha_w1_h5_l14_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mmrook_team-puma-sock', 14),
  ('cha_w1_h5_l15_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h5', 'creg_mmrook_two-guys-big-thighs', 15),
  ('cha_w1_h6_l1_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_barbell-babes', 1),
  ('cha_w1_h6_l2_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_bustin', 2),
  ('cha_w1_h6_l3_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_fireside-centurions', 3),
  ('cha_w1_h6_l4_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_northside-thugs-n-ha', 4),
  ('cha_w1_h6_l5_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_old-broken', 5),
  ('cha_w1_h6_l6_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_spud-brothers', 6),
  ('cha_w1_h6_l7_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_super-snatch-bros', 7),
  ('cha_w1_h6_l8_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_t-c', 8),
  ('cha_w1_h6_l9_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_team-propath', 9),
  ('cha_w1_h6_l10_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h6', 'creg_mmrx_timmy-and-the-brain', 10),
  ('cha_w1_h8_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_burpees-and-biscuits', 2),
  ('cha_w1_h8_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_burrito-bros', 3),
  ('cha_w1_h8_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_factory-doughnutties', 4),
  ('cha_w1_h8_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_fourth-and-wod', 5),
  ('cha_w1_h8_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_grab-em-by-the-dumbb', 6),
  ('cha_w1_h8_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_high-bar-low-bar', 7),
  ('cha_w1_h8_l8_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_howen', 8),
  ('cha_w1_h8_l9_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_mileage-mayhem', 9),
  ('cha_w1_h8_l10_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_peter-parkers', 10),
  ('cha_w1_h8_l11_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_pupsiki', 11),
  ('cha_w1_h8_l12_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_stratton-oakmont-cro', 12),
  ('cha_w1_h8_l13_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_strong-independent-m', 13),
  ('cha_w1_h8_l14_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h8', 'creg_mint_sugar-daddies', 14),
  ('cha_w1_h9_l1_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_summit-seekers', 1),
  ('cha_w1_h9_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_team-nonchalant', 2),
  ('cha_w1_h9_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_team-saiyan', 3),
  ('cha_w1_h9_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_the-swolemates', 4),
  ('cha_w1_h9_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_the-team-that-shall-', 5),
  ('cha_w1_h9_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_train-town', 6),
  ('cha_w1_h9_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mint_twin-turbo', 7),
  ('cha_w1_h9_l8_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_brown-and-down', 8),
  ('cha_w1_h9_l9_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_gym-bruvz', 9),
  ('cha_w1_h9_l10_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_last-minute-lifters', 10),
  ('cha_w1_h9_l11_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_rice-beans', 11),
  ('cha_w1_h9_l12_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_rowing-pains', 12),
  ('cha_w1_h9_l13_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_sweaty-and-regrety', 13),
  ('cha_w1_h9_l14_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_the-team-the-team-go', 14),
  ('cha_w1_h9_l16_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h9', 'creg_mrook_young-bull-old-goat', 16),
  ('cha_w1_h10_l1_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_2-snatched-2-quit', 1),
  ('cha_w1_h10_l2_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_bend-and-snap', 2),
  ('cha_w1_h10_l3_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_chalk-dirty-to-me', 3),
  ('cha_w1_h10_l4_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_dog-mom-duo', 4),
  ('cha_w1_h10_l5_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_flex-appeal', 5),
  ('cha_w1_h10_l6_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_floss-n-fades', 6),
  ('cha_w1_h10_l7_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_grit-grace', 7),
  ('cha_w1_h10_l8_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_kettlebelles', 8),
  ('cha_w1_h10_l9_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_look-wod-you-made-me', 9),
  ('cha_w1_h10_l10_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_masters-in-motion', 10),
  ('cha_w1_h10_l11_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_mother-hustlers', 11),
  ('cha_w1_h10_l12_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_muscle-milkmaids', 12),
  ('cha_w1_h10_l13_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_oh-snatch', 13),
  ('cha_w1_h10_l14_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_the-cougar-and-the-k', 14),
  ('cha_w1_h10_l15_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h10', 'creg_wrook_we-were-on-a-break', 15),
  ('cha_w1_h11_l1_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_critter-gitters', 1),
  ('cha_w1_h11_l2_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_double-wonders', 2),
  ('cha_w1_h11_l3_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_down-bad-crying-at-t', 3),
  ('cha_w1_h11_l4_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_flexual-healing', 4),
  ('cha_w1_h11_l5_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_gabz-and-make-it-rai', 5),
  ('cha_w1_h11_l6_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_grins-and-wins', 6),
  ('cha_w1_h11_l7_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_hot-mom-era', 7),
  ('cha_w1_h11_l8_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_hustle-muscle', 8),
  ('cha_w1_h11_l9_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_long-distance-lifter', 9),
  ('cha_w1_h11_l10_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_misplaced-masters', 10),
  ('cha_w1_h11_l11_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_pr-or-er', 11),
  ('cha_w1_h11_l12_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_social-hour', 12),
  ('cha_w1_h11_l13_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_the-power-puff-girls', 13),
  ('cha_w1_h11_l14_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_thunder-lightning', 14),
  ('cha_w1_h11_l15_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_verdant-vixens', 15),
  ('cha_w1_h11_l16_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h11', 'creg_wint_woddesses', 16),
  ('cha_w1_h12_l2_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_arbor-mcfit', 2),
  ('cha_w1_h12_l3_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_hannah-montana', 3),
  ('cha_w1_h12_l4_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_hot-mess-express', 4),
  ('cha_w1_h12_l5_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_jacked-in-the-box', 5),
  ('cha_w1_h12_l6_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_m-m', 6),
  ('cha_w1_h12_l7_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_m-m-mayhem', 7),
  ('cha_w1_h12_l8_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_naddy-the-baddies', 8),
  ('cha_w1_h12_l9_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_northside-naptime-ni', 9),
  ('cha_w1_h12_l10_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_not-dying-just-gesta', 10),
  ('cha_w1_h12_l11_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_o-doyle-rules', 11),
  ('cha_w1_h12_l12_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_power-princesses', 12),
  ('cha_w1_h12_l13_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_quad-squad', 13),
  ('cha_w1_h12_l14_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_snatching-with-siren', 14),
  ('cha_w1_h12_l15_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w1_h12', 'creg_wrx_supermom-squad', 15);

-- Workout 2 Heat Assignments
INSERT OR REPLACE INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  ('cha_w2_h1_l1_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_breakfast-dinner', 1),
  ('cha_w2_h1_l2_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_cheez-it-extra-toast', 2),
  ('cha_w2_h1_l3_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_feel-the-mcburn', 3),
  ('cha_w2_h1_l4_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_fitz-and-furious', 4),
  ('cha_w2_h1_l5_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_geweck-yourselves', 5),
  ('cha_w2_h1_l6_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_let-em-cook', 6),
  ('cha_w2_h1_l7_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_richardson-rebels', 7),
  ('cha_w2_h1_l8_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_sin-miedo', 8),
  ('cha_w2_h1_l9_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_sore-losers', 9),
  ('cha_w2_h1_l10_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_crook_the-rex-factor', 10),
  ('cha_w2_h1_l11_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_mcint_blue-eyed-beasts', 11),
  ('cha_w2_h1_l12_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_mcint_i-ve-got-a-headache', 12),
  ('cha_w2_h1_l13_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_mcint_plus-ultra', 13),
  ('cha_w2_h1_l14_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_mcint_squat-me-baby', 14),
  ('cha_w2_h1_l15_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_mcint_team-nancy-resting-b', 15),
  ('cha_w2_h1_l16_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h1', 'creg_mcint_the-zzzs', 16),
  ('cha_w2_h2_l1_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_verdantside', 1),
  ('cha_w2_h2_l2_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_96-chicago-bulls', 2),
  ('cha_w2_h2_l3_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_ag-fan-club', 3),
  ('cha_w2_h2_l4_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_daddy-with-a-phatty', 4),
  ('cha_w2_h2_l5_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_em-and-m', 5),
  ('cha_w2_h2_l6_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_gcs-3', 6),
  ('cha_w2_h2_l7_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_goofy-goobers', 7),
  ('cha_w2_h2_l8_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_mules-of-co-pain', 8),
  ('cha_w2_h2_l9_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_queen-and-jerk', 9),
  ('cha_w2_h2_l10_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_rodeo-rhymers', 10),
  ('cha_w2_h2_l11_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_team-day-ones', 11),
  ('cha_w2_h2_l12_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_trident-athletics', 12),
  ('cha_w2_h2_l13_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h2', 'creg_crx_two-toned-thunder', 13),
  ('cha_w2_h3_l1_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_mcrx_aged-to-perfection', 1),
  ('cha_w2_h3_l2_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_mcrx_hgr-cbd-athletics', 2),
  ('cha_w2_h3_l3_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_mcrx_nooners', 3),
  ('cha_w2_h3_l4_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_mcrx_sigma-and-gyat', 4),
  ('cha_w2_h3_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_battle-born-and-worn', 5),
  ('cha_w2_h3_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_beat-boxers', 6),
  ('cha_w2_h3_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_bubba-needs-help', 7),
  ('cha_w2_h3_l8_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_cam-and-kenn', 8),
  ('cha_w2_h3_l9_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_deadlifts-chill', 9),
  ('cha_w2_h3_l10_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_dnr', 10),
  ('cha_w2_h3_l11_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_dos-chanchos', 11),
  ('cha_w2_h3_l12_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_grass-fed-grass-fini', 12),
  ('cha_w2_h3_l13_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_hustle-and-muscle', 13),
  ('cha_w2_h3_l14_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_misery-loves-company', 14),
  ('cha_w2_h3_l15_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_no-rep-no-whey', 15),
  ('cha_w2_h3_l16_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h3', 'creg_cint_row-mates-for-life', 16),
  ('cha_w2_h4_l1_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_swole-in-spirit', 1),
  ('cha_w2_h4_l2_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_swolemates', 2),
  ('cha_w2_h4_l3_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_the-frenchies', 3),
  ('cha_w2_h4_l4_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_thicc-and-tired', 4),
  ('cha_w2_h4_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_untaymable', 5),
  ('cha_w2_h4_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_what-would-froning-d', 6),
  ('cha_w2_h4_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_cint_wod-my-name-out-yo-m', 7),
  ('cha_w2_h4_l8_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_ambiguously-qualifie', 8),
  ('cha_w2_h4_l9_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_check-engine', 9),
  ('cha_w2_h4_l10_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_dad-bod-dynasty', 10),
  ('cha_w2_h4_l11_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_fullertons-old-schoo', 11),
  ('cha_w2_h4_l12_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_good', 12),
  ('cha_w2_h4_l13_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_irish-wristwatch', 13),
  ('cha_w2_h4_l14_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_obsolete', 14),
  ('cha_w2_h4_l15_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_red', 15),
  ('cha_w2_h4_l16_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h4', 'creg_mmint_thruster-i-hardly-kn', 16),
  ('cha_w2_h5_l1_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_10-kids-later', 1),
  ('cha_w2_h5_l2_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_apple-bottom-cleans', 2),
  ('cha_w2_h5_l3_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_barbell-bros', 3),
  ('cha_w2_h5_l4_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_built-in-black', 4),
  ('cha_w2_h5_l5_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_captain-baby', 5),
  ('cha_w2_h5_l6_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_gen-x-flex', 6),
  ('cha_w2_h5_l7_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_iron-valkyrie-sister', 7),
  ('cha_w2_h5_l8_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_not-fast-just-furiou', 8),
  ('cha_w2_h5_l9_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mwint_slay-all-day', 9),
  ('cha_w2_h5_l11_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mmrook_worst-pace-scenario', 11),
  ('cha_w2_h5_l12_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mmrook_mexican-jumping-bean', 12),
  ('cha_w2_h5_l13_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mmrook_peaked-in-high-schoo', 13),
  ('cha_w2_h5_l14_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mmrook_team-puma-sock', 14),
  ('cha_w2_h5_l15_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h5', 'creg_mmrook_two-guys-big-thighs', 15),
  ('cha_w2_h6_l1_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_barbell-babes', 1),
  ('cha_w2_h6_l2_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_bustin', 2),
  ('cha_w2_h6_l3_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_fireside-centurions', 3),
  ('cha_w2_h6_l4_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_northside-thugs-n-ha', 4),
  ('cha_w2_h6_l5_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_old-broken', 5),
  ('cha_w2_h6_l6_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_spud-brothers', 6),
  ('cha_w2_h6_l7_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_super-snatch-bros', 7),
  ('cha_w2_h6_l8_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_t-c', 8),
  ('cha_w2_h6_l9_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_team-propath', 9),
  ('cha_w2_h6_l10_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h6', 'creg_mmrx_timmy-and-the-brain', 10),
  ('cha_w2_h8_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_burpees-and-biscuits', 2),
  ('cha_w2_h8_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_burrito-bros', 3),
  ('cha_w2_h8_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_factory-doughnutties', 4),
  ('cha_w2_h8_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_fourth-and-wod', 5),
  ('cha_w2_h8_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_grab-em-by-the-dumbb', 6),
  ('cha_w2_h8_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_high-bar-low-bar', 7),
  ('cha_w2_h8_l8_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_howen', 8),
  ('cha_w2_h8_l9_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_mileage-mayhem', 9),
  ('cha_w2_h8_l10_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_peter-parkers', 10),
  ('cha_w2_h8_l11_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_pupsiki', 11),
  ('cha_w2_h8_l12_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_stratton-oakmont-cro', 12),
  ('cha_w2_h8_l13_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_strong-independent-m', 13),
  ('cha_w2_h8_l14_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h8', 'creg_mint_sugar-daddies', 14),
  ('cha_w2_h9_l1_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_summit-seekers', 1),
  ('cha_w2_h9_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_team-nonchalant', 2),
  ('cha_w2_h9_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_team-saiyan', 3),
  ('cha_w2_h9_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_the-swolemates', 4),
  ('cha_w2_h9_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_the-team-that-shall-', 5),
  ('cha_w2_h9_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_train-town', 6),
  ('cha_w2_h9_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mint_twin-turbo', 7),
  ('cha_w2_h9_l8_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_brown-and-down', 8),
  ('cha_w2_h9_l9_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_gym-bruvz', 9),
  ('cha_w2_h9_l10_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_last-minute-lifters', 10),
  ('cha_w2_h9_l11_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_rice-beans', 11),
  ('cha_w2_h9_l12_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_rowing-pains', 12),
  ('cha_w2_h9_l13_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_sweaty-and-regrety', 13),
  ('cha_w2_h9_l14_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_the-team-the-team-go', 14),
  ('cha_w2_h9_l16_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h9', 'creg_mrook_young-bull-old-goat', 16),
  ('cha_w2_h10_l1_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_2-snatched-2-quit', 1),
  ('cha_w2_h10_l2_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_bend-and-snap', 2),
  ('cha_w2_h10_l3_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_chalk-dirty-to-me', 3),
  ('cha_w2_h10_l4_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_dog-mom-duo', 4),
  ('cha_w2_h10_l5_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_flex-appeal', 5),
  ('cha_w2_h10_l6_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_floss-n-fades', 6),
  ('cha_w2_h10_l7_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_grit-grace', 7),
  ('cha_w2_h10_l8_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_kettlebelles', 8),
  ('cha_w2_h10_l9_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_look-wod-you-made-me', 9),
  ('cha_w2_h10_l10_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_masters-in-motion', 10),
  ('cha_w2_h10_l11_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_mother-hustlers', 11),
  ('cha_w2_h10_l12_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_muscle-milkmaids', 12),
  ('cha_w2_h10_l13_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_oh-snatch', 13),
  ('cha_w2_h10_l14_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_the-cougar-and-the-k', 14),
  ('cha_w2_h10_l15_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h10', 'creg_wrook_we-were-on-a-break', 15),
  ('cha_w2_h11_l1_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_critter-gitters', 1),
  ('cha_w2_h11_l2_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_double-wonders', 2),
  ('cha_w2_h11_l3_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_down-bad-crying-at-t', 3),
  ('cha_w2_h11_l4_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_flexual-healing', 4),
  ('cha_w2_h11_l5_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_gabz-and-make-it-rai', 5),
  ('cha_w2_h11_l6_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_grins-and-wins', 6),
  ('cha_w2_h11_l7_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_hot-mom-era', 7),
  ('cha_w2_h11_l8_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_hustle-muscle', 8),
  ('cha_w2_h11_l9_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_long-distance-lifter', 9),
  ('cha_w2_h11_l10_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_misplaced-masters', 10),
  ('cha_w2_h11_l11_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_pr-or-er', 11),
  ('cha_w2_h11_l12_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_social-hour', 12),
  ('cha_w2_h11_l13_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_the-power-puff-girls', 13),
  ('cha_w2_h11_l14_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_thunder-lightning', 14),
  ('cha_w2_h11_l15_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_verdant-vixens', 15),
  ('cha_w2_h11_l16_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h11', 'creg_wint_woddesses', 16),
  ('cha_w2_h12_l2_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_arbor-mcfit', 2),
  ('cha_w2_h12_l3_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_hannah-montana', 3),
  ('cha_w2_h12_l4_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_hot-mess-express', 4),
  ('cha_w2_h12_l5_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_jacked-in-the-box', 5),
  ('cha_w2_h12_l6_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_m-m', 6),
  ('cha_w2_h12_l7_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_m-m-mayhem', 7),
  ('cha_w2_h12_l8_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_naddy-the-baddies', 8),
  ('cha_w2_h12_l9_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_northside-naptime-ni', 9),
  ('cha_w2_h12_l10_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_not-dying-just-gesta', 10),
  ('cha_w2_h12_l11_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_o-doyle-rules', 11),
  ('cha_w2_h12_l12_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_power-princesses', 12),
  ('cha_w2_h12_l13_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_quad-squad', 13),
  ('cha_w2_h12_l14_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_snatching-with-siren', 14),
  ('cha_w2_h12_l15_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w2_h12', 'creg_wrx_supermom-squad', 15);

-- Workout 3 Heat Assignments
INSERT OR REPLACE INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  ('cha_w3_h1_l1_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_breakfast-dinner', 1),
  ('cha_w3_h1_l2_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_cheez-it-extra-toast', 2),
  ('cha_w3_h1_l3_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_feel-the-mcburn', 3),
  ('cha_w3_h1_l4_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_fitz-and-furious', 4),
  ('cha_w3_h1_l5_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_geweck-yourselves', 5),
  ('cha_w3_h1_l6_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_let-em-cook', 6),
  ('cha_w3_h1_l7_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_richardson-rebels', 7),
  ('cha_w3_h1_l8_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_sin-miedo', 8),
  ('cha_w3_h1_l9_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_sore-losers', 9),
  ('cha_w3_h1_l10_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_crook_the-rex-factor', 10),
  ('cha_w3_h1_l11_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_mcint_blue-eyed-beasts', 11),
  ('cha_w3_h1_l12_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_mcint_i-ve-got-a-headache', 12),
  ('cha_w3_h1_l13_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_mcint_plus-ultra', 13),
  ('cha_w3_h1_l14_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_mcint_squat-me-baby', 14),
  ('cha_w3_h1_l15_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_mcint_team-nancy-resting-b', 15),
  ('cha_w3_h1_l16_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h1', 'creg_mcint_the-zzzs', 16),
  ('cha_w3_h2_l1_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_verdantside', 1),
  ('cha_w3_h2_l2_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_96-chicago-bulls', 2),
  ('cha_w3_h2_l3_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_ag-fan-club', 3),
  ('cha_w3_h2_l4_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_daddy-with-a-phatty', 4),
  ('cha_w3_h2_l5_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_em-and-m', 5),
  ('cha_w3_h2_l6_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_gcs-3', 6),
  ('cha_w3_h2_l7_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_goofy-goobers', 7),
  ('cha_w3_h2_l8_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_mules-of-co-pain', 8),
  ('cha_w3_h2_l9_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_queen-and-jerk', 9),
  ('cha_w3_h2_l10_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_rodeo-rhymers', 10),
  ('cha_w3_h2_l11_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_team-day-ones', 11),
  ('cha_w3_h2_l12_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_trident-athletics', 12),
  ('cha_w3_h2_l13_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h2', 'creg_crx_two-toned-thunder', 13),
  ('cha_w3_h3_l1_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_mcrx_aged-to-perfection', 1),
  ('cha_w3_h3_l2_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_mcrx_hgr-cbd-athletics', 2),
  ('cha_w3_h3_l3_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_mcrx_nooners', 3),
  ('cha_w3_h3_l4_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_mcrx_sigma-and-gyat', 4),
  ('cha_w3_h3_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_battle-born-and-worn', 5),
  ('cha_w3_h3_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_beat-boxers', 6),
  ('cha_w3_h3_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_bubba-needs-help', 7),
  ('cha_w3_h3_l8_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_cam-and-kenn', 8),
  ('cha_w3_h3_l9_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_deadlifts-chill', 9),
  ('cha_w3_h3_l10_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_dnr', 10),
  ('cha_w3_h3_l11_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_dos-chanchos', 11),
  ('cha_w3_h3_l12_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_grass-fed-grass-fini', 12),
  ('cha_w3_h3_l13_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_hustle-and-muscle', 13),
  ('cha_w3_h3_l14_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_misery-loves-company', 14),
  ('cha_w3_h3_l15_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_no-rep-no-whey', 15),
  ('cha_w3_h3_l16_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h3', 'creg_cint_row-mates-for-life', 16),
  ('cha_w3_h4_l1_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_swole-in-spirit', 1),
  ('cha_w3_h4_l2_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_swolemates', 2),
  ('cha_w3_h4_l3_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_the-frenchies', 3),
  ('cha_w3_h4_l4_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_thicc-and-tired', 4),
  ('cha_w3_h4_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_untaymable', 5),
  ('cha_w3_h4_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_what-would-froning-d', 6),
  ('cha_w3_h4_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_cint_wod-my-name-out-yo-m', 7),
  ('cha_w3_h4_l8_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_ambiguously-qualifie', 8),
  ('cha_w3_h4_l9_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_check-engine', 9),
  ('cha_w3_h4_l10_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_dad-bod-dynasty', 10),
  ('cha_w3_h4_l11_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_fullertons-old-schoo', 11),
  ('cha_w3_h4_l12_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_good', 12),
  ('cha_w3_h4_l13_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_irish-wristwatch', 13),
  ('cha_w3_h4_l14_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_obsolete', 14),
  ('cha_w3_h4_l15_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_red', 15),
  ('cha_w3_h4_l16_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h4', 'creg_mmint_thruster-i-hardly-kn', 16),
  ('cha_w3_h5_l1_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_10-kids-later', 1),
  ('cha_w3_h5_l2_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_apple-bottom-cleans', 2),
  ('cha_w3_h5_l3_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_barbell-bros', 3),
  ('cha_w3_h5_l4_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_built-in-black', 4),
  ('cha_w3_h5_l5_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_captain-baby', 5),
  ('cha_w3_h5_l6_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_gen-x-flex', 6),
  ('cha_w3_h5_l7_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_iron-valkyrie-sister', 7),
  ('cha_w3_h5_l8_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_not-fast-just-furiou', 8),
  ('cha_w3_h5_l9_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mwint_slay-all-day', 9),
  ('cha_w3_h5_l11_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mmrook_worst-pace-scenario', 11),
  ('cha_w3_h5_l12_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mmrook_mexican-jumping-bean', 12),
  ('cha_w3_h5_l13_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mmrook_peaked-in-high-schoo', 13),
  ('cha_w3_h5_l14_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mmrook_team-puma-sock', 14),
  ('cha_w3_h5_l15_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h5', 'creg_mmrook_two-guys-big-thighs', 15),
  ('cha_w3_h6_l1_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_barbell-babes', 1),
  ('cha_w3_h6_l2_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_bustin', 2),
  ('cha_w3_h6_l3_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_fireside-centurions', 3),
  ('cha_w3_h6_l4_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_northside-thugs-n-ha', 4),
  ('cha_w3_h6_l5_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_old-broken', 5),
  ('cha_w3_h6_l6_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_spud-brothers', 6),
  ('cha_w3_h6_l7_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_super-snatch-bros', 7),
  ('cha_w3_h6_l8_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_t-c', 8),
  ('cha_w3_h6_l9_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_team-propath', 9),
  ('cha_w3_h6_l10_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h6', 'creg_mmrx_timmy-and-the-brain', 10),
  ('cha_w3_h8_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_burpees-and-biscuits', 2),
  ('cha_w3_h8_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_burrito-bros', 3),
  ('cha_w3_h8_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_factory-doughnutties', 4),
  ('cha_w3_h8_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_fourth-and-wod', 5),
  ('cha_w3_h8_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_grab-em-by-the-dumbb', 6),
  ('cha_w3_h8_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_high-bar-low-bar', 7),
  ('cha_w3_h8_l8_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_howen', 8),
  ('cha_w3_h8_l9_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_mileage-mayhem', 9),
  ('cha_w3_h8_l10_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_peter-parkers', 10),
  ('cha_w3_h8_l11_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_pupsiki', 11),
  ('cha_w3_h8_l12_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_stratton-oakmont-cro', 12),
  ('cha_w3_h8_l13_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_strong-independent-m', 13),
  ('cha_w3_h8_l14_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h8', 'creg_mint_sugar-daddies', 14),
  ('cha_w3_h9_l1_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_summit-seekers', 1),
  ('cha_w3_h9_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_team-nonchalant', 2),
  ('cha_w3_h9_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_team-saiyan', 3),
  ('cha_w3_h9_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_the-swolemates', 4),
  ('cha_w3_h9_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_the-team-that-shall-', 5),
  ('cha_w3_h9_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_train-town', 6),
  ('cha_w3_h9_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mint_twin-turbo', 7),
  ('cha_w3_h9_l8_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_brown-and-down', 8),
  ('cha_w3_h9_l9_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_gym-bruvz', 9),
  ('cha_w3_h9_l10_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_last-minute-lifters', 10),
  ('cha_w3_h9_l11_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_rice-beans', 11),
  ('cha_w3_h9_l12_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_rowing-pains', 12),
  ('cha_w3_h9_l13_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_sweaty-and-regrety', 13),
  ('cha_w3_h9_l14_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_the-team-the-team-go', 14),
  ('cha_w3_h9_l16_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h9', 'creg_mrook_young-bull-old-goat', 16),
  ('cha_w3_h10_l1_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_2-snatched-2-quit', 1),
  ('cha_w3_h10_l2_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_bend-and-snap', 2),
  ('cha_w3_h10_l3_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_chalk-dirty-to-me', 3),
  ('cha_w3_h10_l4_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_dog-mom-duo', 4),
  ('cha_w3_h10_l5_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_flex-appeal', 5),
  ('cha_w3_h10_l6_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_floss-n-fades', 6),
  ('cha_w3_h10_l7_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_grit-grace', 7),
  ('cha_w3_h10_l8_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_kettlebelles', 8),
  ('cha_w3_h10_l9_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_look-wod-you-made-me', 9),
  ('cha_w3_h10_l10_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_masters-in-motion', 10),
  ('cha_w3_h10_l11_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_mother-hustlers', 11),
  ('cha_w3_h10_l12_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_muscle-milkmaids', 12),
  ('cha_w3_h10_l13_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_oh-snatch', 13),
  ('cha_w3_h10_l14_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_the-cougar-and-the-k', 14),
  ('cha_w3_h10_l15_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h10', 'creg_wrook_we-were-on-a-break', 15),
  ('cha_w3_h11_l1_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_critter-gitters', 1),
  ('cha_w3_h11_l2_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_double-wonders', 2),
  ('cha_w3_h11_l3_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_down-bad-crying-at-t', 3),
  ('cha_w3_h11_l4_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_flexual-healing', 4),
  ('cha_w3_h11_l5_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_gabz-and-make-it-rai', 5),
  ('cha_w3_h11_l6_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_grins-and-wins', 6),
  ('cha_w3_h11_l7_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_hot-mom-era', 7),
  ('cha_w3_h11_l8_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_hustle-muscle', 8),
  ('cha_w3_h11_l9_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_long-distance-lifter', 9),
  ('cha_w3_h11_l10_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_misplaced-masters', 10),
  ('cha_w3_h11_l11_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_pr-or-er', 11),
  ('cha_w3_h11_l12_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_social-hour', 12),
  ('cha_w3_h11_l13_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_the-power-puff-girls', 13),
  ('cha_w3_h11_l14_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_thunder-lightning', 14),
  ('cha_w3_h11_l15_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_verdant-vixens', 15),
  ('cha_w3_h11_l16_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h11', 'creg_wint_woddesses', 16),
  ('cha_w3_h12_l2_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_arbor-mcfit', 2),
  ('cha_w3_h12_l3_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_hannah-montana', 3),
  ('cha_w3_h12_l4_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_hot-mess-express', 4),
  ('cha_w3_h12_l5_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_jacked-in-the-box', 5),
  ('cha_w3_h12_l6_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_m-m', 6),
  ('cha_w3_h12_l7_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_m-m-mayhem', 7),
  ('cha_w3_h12_l8_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_naddy-the-baddies', 8),
  ('cha_w3_h12_l9_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_northside-naptime-ni', 9),
  ('cha_w3_h12_l10_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_not-dying-just-gesta', 10),
  ('cha_w3_h12_l11_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_o-doyle-rules', 11),
  ('cha_w3_h12_l12_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_power-princesses', 12),
  ('cha_w3_h12_l13_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_quad-squad', 13),
  ('cha_w3_h12_l14_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_snatching-with-siren', 14),
  ('cha_w3_h12_l15_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w3_h12', 'creg_wrx_supermom-squad', 15);

-- Workout 4 Heat Assignments
INSERT OR REPLACE INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  ('cha_w4_h1_l1_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_richardson-rebels', 1),
  ('cha_w4_h1_l2_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_feel-the-mcburn', 2),
  ('cha_w4_h1_l3_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_sin-miedo', 3),
  ('cha_w4_h1_l4_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_let-em-cook', 4),
  ('cha_w4_h1_l5_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_breakfast-dinner', 5),
  ('cha_w4_h1_l6_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_geweck-yourselves', 6),
  ('cha_w4_h1_l7_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_the-rex-factor', 7),
  ('cha_w4_h1_l8_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_sore-losers', 8),
  ('cha_w4_h1_l9_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_cheez-it-extra-toast', 9),
  ('cha_w4_h1_l10_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_crook_fitz-and-furious', 10),
  ('cha_w4_h1_l11_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_mcint_i-ve-got-a-headache', 11),
  ('cha_w4_h1_l12_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_mcint_plus-ultra', 12),
  ('cha_w4_h1_l13_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_mcint_the-zzzs', 13),
  ('cha_w4_h1_l14_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_mcint_team-nancy-resting-b', 14),
  ('cha_w4_h1_l15_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_mcint_squat-me-baby', 15),
  ('cha_w4_h1_l16_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h1', 'creg_mcint_blue-eyed-beasts', 16),
  ('cha_w4_h2_l2_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_daddy-with-a-phatty', 2),
  ('cha_w4_h2_l3_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_queen-and-jerk', 3),
  ('cha_w4_h2_l4_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_gcs-3', 4),
  ('cha_w4_h2_l5_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_verdantside', 5),
  ('cha_w4_h2_l6_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_team-day-ones', 6),
  ('cha_w4_h2_l7_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_goofy-goobers', 7),
  ('cha_w4_h2_l8_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_em-and-m', 8),
  ('cha_w4_h2_l9_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_mules-of-co-pain', 9),
  ('cha_w4_h2_l10_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_96-chicago-bulls', 10),
  ('cha_w4_h2_l11_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_trident-athletics', 11),
  ('cha_w4_h2_l12_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_ag-fan-club', 12),
  ('cha_w4_h2_l13_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_rodeo-rhymers', 13),
  ('cha_w4_h2_l14_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h2', 'creg_crx_two-toned-thunder', 14),
  ('cha_w4_h3_l1_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_mcrx_aged-to-perfection', 1),
  ('cha_w4_h3_l2_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_mcrx_nooners', 2),
  ('cha_w4_h3_l3_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_mcrx_sigma-and-gyat', 3),
  ('cha_w4_h3_l4_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_mcrx_hgr-cbd-athletics', 4),
  ('cha_w4_h3_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_beat-boxers', 5),
  ('cha_w4_h3_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_cam-and-kenn', 6),
  ('cha_w4_h3_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_wod-my-name-out-yo-m', 7),
  ('cha_w4_h3_l8_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_deadlifts-chill', 8),
  ('cha_w4_h3_l9_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_what-would-froning-d', 9),
  ('cha_w4_h3_l10_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_row-mates-for-life', 10),
  ('cha_w4_h3_l11_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_the-frenchies', 11),
  ('cha_w4_h3_l12_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_misery-loves-company', 12),
  ('cha_w4_h3_l13_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_no-rep-no-whey', 13),
  ('cha_w4_h3_l14_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_bubba-needs-help', 14),
  ('cha_w4_h3_l15_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_thicc-and-tired', 15),
  ('cha_w4_h3_l16_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h3', 'creg_cint_untaymable', 16),
  ('cha_w4_h4_l1_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_hustle-and-muscle', 1),
  ('cha_w4_h4_l2_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_swolemates', 2),
  ('cha_w4_h4_l3_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_dnr', 3),
  ('cha_w4_h4_l4_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_grass-fed-grass-fini', 4),
  ('cha_w4_h4_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_swole-in-spirit', 5),
  ('cha_w4_h4_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_battle-born-and-worn', 6),
  ('cha_w4_h4_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_cint_dos-chanchos', 7),
  ('cha_w4_h4_l8_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_irish-wristwatch', 8),
  ('cha_w4_h4_l9_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_red', 9),
  ('cha_w4_h4_l10_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_good', 10),
  ('cha_w4_h4_l11_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_ambiguously-qualifie', 11),
  ('cha_w4_h4_l12_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_check-engine', 12),
  ('cha_w4_h4_l13_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_dad-bod-dynasty', 13),
  ('cha_w4_h4_l14_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_obsolete', 14),
  ('cha_w4_h4_l15_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_thruster-i-hardly-kn', 15),
  ('cha_w4_h4_l16_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h4', 'creg_mmint_fullertons-old-schoo', 16),
  ('cha_w4_h5_l1_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_not-fast-just-furiou', 1),
  ('cha_w4_h5_l2_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_gen-x-flex', 2),
  ('cha_w4_h5_l3_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_captain-baby', 3),
  ('cha_w4_h5_l4_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_iron-valkyrie-sister', 4),
  ('cha_w4_h5_l5_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_barbell-bros', 5),
  ('cha_w4_h5_l6_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_slay-all-day', 6),
  ('cha_w4_h5_l7_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_10-kids-later', 7),
  ('cha_w4_h5_l8_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_built-in-black', 8),
  ('cha_w4_h5_l9_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mwint_apple-bottom-cleans', 9),
  ('cha_w4_h5_l11_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mmrook_mexican-jumping-bean', 11),
  ('cha_w4_h5_l12_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mmrook_two-guys-big-thighs', 12),
  ('cha_w4_h5_l13_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mmrook_peaked-in-high-schoo', 13),
  ('cha_w4_h5_l14_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mmrook_worst-pace-scenario', 14),
  ('cha_w4_h5_l15_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h5', 'creg_mmrook_team-puma-sock', 15),
  ('cha_w4_h6_l4_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_fireside-centurions', 4),
  ('cha_w4_h6_l5_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_bustin', 5),
  ('cha_w4_h6_l6_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_super-snatch-bros', 6),
  ('cha_w4_h6_l7_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_northside-thugs-n-ha', 7),
  ('cha_w4_h6_l8_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_spud-brothers', 8),
  ('cha_w4_h6_l9_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_team-propath', 9),
  ('cha_w4_h6_l10_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_old-broken', 10),
  ('cha_w4_h6_l11_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_barbell-babes', 11),
  ('cha_w4_h6_l12_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_timmy-and-the-brain', 12),
  ('cha_w4_h6_l13_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h6', 'creg_mmrx_t-c', 13),
  ('cha_w4_h8_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_high-bar-low-bar', 3),
  ('cha_w4_h8_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_grab-em-by-the-dumbb', 4),
  ('cha_w4_h8_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_the-team-that-shall-', 5),
  ('cha_w4_h8_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_mileage-mayhem', 6),
  ('cha_w4_h8_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_fourth-and-wod', 7),
  ('cha_w4_h8_l8_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_team-nonchalant', 8),
  ('cha_w4_h8_l9_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_twin-turbo', 9),
  ('cha_w4_h8_l10_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_team-saiyan', 10),
  ('cha_w4_h8_l11_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_peter-parkers', 11),
  ('cha_w4_h8_l12_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_the-swolemates', 12),
  ('cha_w4_h8_l13_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_sugar-daddies', 13),
  ('cha_w4_h8_l14_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h8', 'creg_mint_train-town', 14),
  ('cha_w4_h9_l1_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_howen', 1),
  ('cha_w4_h9_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_summit-seekers', 2),
  ('cha_w4_h9_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_strong-independent-m', 3),
  ('cha_w4_h9_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_stratton-oakmont-cro', 4),
  ('cha_w4_h9_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_burrito-bros', 5),
  ('cha_w4_h9_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_burpees-and-biscuits', 6),
  ('cha_w4_h9_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mint_pupsiki', 7),
  ('cha_w4_h9_l9_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_the-team-the-team-go', 9),
  ('cha_w4_h9_l10_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_young-bull-old-goat', 10),
  ('cha_w4_h9_l11_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_sweaty-and-regrety', 11),
  ('cha_w4_h9_l12_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_brown-and-down', 12),
  ('cha_w4_h9_l13_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_gym-bruvz', 13),
  ('cha_w4_h9_l14_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_rowing-pains', 14),
  ('cha_w4_h9_l15_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_rice-beans', 15),
  ('cha_w4_h9_l16_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h9', 'creg_mrook_last-minute-lifters', 16),
  ('cha_w4_h10_l1_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_floss-n-fades', 1),
  ('cha_w4_h10_l2_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_look-wod-you-made-me', 2),
  ('cha_w4_h10_l3_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_mother-hustlers', 3),
  ('cha_w4_h10_l4_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_grit-grace', 4),
  ('cha_w4_h10_l5_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_dog-mom-duo', 5),
  ('cha_w4_h10_l6_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_oh-snatch', 6),
  ('cha_w4_h10_l7_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_masters-in-motion', 7),
  ('cha_w4_h10_l8_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_we-were-on-a-break', 8),
  ('cha_w4_h10_l9_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_kettlebelles', 9),
  ('cha_w4_h10_l10_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_bend-and-snap', 10),
  ('cha_w4_h10_l11_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_muscle-milkmaids', 11),
  ('cha_w4_h10_l12_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_flex-appeal', 12),
  ('cha_w4_h10_l13_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_the-cougar-and-the-k', 13),
  ('cha_w4_h10_l14_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_2-snatched-2-quit', 14),
  ('cha_w4_h10_l15_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h10', 'creg_wrook_chalk-dirty-to-me', 15),
  ('cha_w4_h11_l1_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_critter-gitters', 1),
  ('cha_w4_h11_l2_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_double-wonders', 2),
  ('cha_w4_h11_l3_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_down-bad-crying-at-t', 3),
  ('cha_w4_h11_l4_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_flexual-healing', 4),
  ('cha_w4_h11_l5_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_gabz-and-make-it-rai', 5),
  ('cha_w4_h11_l6_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_grins-and-wins', 6),
  ('cha_w4_h11_l7_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_hot-mom-era', 7),
  ('cha_w4_h11_l8_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_hustle-muscle', 8),
  ('cha_w4_h11_l9_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_long-distance-lifter', 9),
  ('cha_w4_h11_l10_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_misplaced-masters', 10),
  ('cha_w4_h11_l11_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_pr-or-er', 11),
  ('cha_w4_h11_l12_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_social-hour', 12),
  ('cha_w4_h11_l13_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_the-power-puff-girls', 13),
  ('cha_w4_h11_l14_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_thunder-lightning', 14),
  ('cha_w4_h11_l15_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_verdant-vixens', 15),
  ('cha_w4_h11_l16_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h11', 'creg_wint_woddesses', 16),
  ('cha_w4_h12_l2_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_hot-mess-express', 2),
  ('cha_w4_h12_l3_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_power-princesses', 3),
  ('cha_w4_h12_l4_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_m-m-mayhem', 4),
  ('cha_w4_h12_l5_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_m-m', 5),
  ('cha_w4_h12_l6_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_northside-naptime-ni', 6),
  ('cha_w4_h12_l7_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_jacked-in-the-box', 7),
  ('cha_w4_h12_l8_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_hannah-montana', 8),
  ('cha_w4_h12_l9_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_naddy-the-baddies', 9),
  ('cha_w4_h12_l10_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_o-doyle-rules', 10),
  ('cha_w4_h12_l11_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_snatching-with-siren', 11),
  ('cha_w4_h12_l12_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_arbor-mcfit', 12),
  ('cha_w4_h12_l13_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_quad-squad', 13),
  ('cha_w4_h12_l14_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_supermom-squad', 14),
  ('cha_w4_h12_l15_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w4_h12', 'creg_wrx_not-dying-just-gesta', 15);

-- Workout 5 Heat Assignments
INSERT OR REPLACE INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  ('cha_w5_h1_l1_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_richardson-rebels', 1),
  ('cha_w5_h1_l2_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_feel-the-mcburn', 2),
  ('cha_w5_h1_l3_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_sin-miedo', 3),
  ('cha_w5_h1_l4_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_let-em-cook', 4),
  ('cha_w5_h1_l5_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_breakfast-dinner', 5),
  ('cha_w5_h1_l6_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_geweck-yourselves', 6),
  ('cha_w5_h1_l7_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_the-rex-factor', 7),
  ('cha_w5_h1_l8_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_sore-losers', 8),
  ('cha_w5_h1_l9_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_cheez-it-extra-toast', 9),
  ('cha_w5_h1_l10_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_crook_fitz-and-furious', 10),
  ('cha_w5_h1_l11_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_mcint_i-ve-got-a-headache', 11),
  ('cha_w5_h1_l12_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_mcint_plus-ultra', 12),
  ('cha_w5_h1_l13_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_mcint_the-zzzs', 13),
  ('cha_w5_h1_l14_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_mcint_team-nancy-resting-b', 14),
  ('cha_w5_h1_l15_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_mcint_squat-me-baby', 15),
  ('cha_w5_h1_l16_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h1', 'creg_mcint_blue-eyed-beasts', 16),
  ('cha_w5_h2_l2_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_daddy-with-a-phatty', 2),
  ('cha_w5_h2_l3_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_queen-and-jerk', 3),
  ('cha_w5_h2_l4_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_gcs-3', 4),
  ('cha_w5_h2_l5_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_verdantside', 5),
  ('cha_w5_h2_l6_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_team-day-ones', 6),
  ('cha_w5_h2_l7_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_goofy-goobers', 7),
  ('cha_w5_h2_l8_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_em-and-m', 8),
  ('cha_w5_h2_l9_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_mules-of-co-pain', 9),
  ('cha_w5_h2_l10_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_96-chicago-bulls', 10),
  ('cha_w5_h2_l11_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_trident-athletics', 11),
  ('cha_w5_h2_l12_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_ag-fan-club', 12),
  ('cha_w5_h2_l13_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_rodeo-rhymers', 13),
  ('cha_w5_h2_l14_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h2', 'creg_crx_two-toned-thunder', 14),
  ('cha_w5_h3_l1_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_mcrx_aged-to-perfection', 1),
  ('cha_w5_h3_l2_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_mcrx_nooners', 2),
  ('cha_w5_h3_l3_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_mcrx_sigma-and-gyat', 3),
  ('cha_w5_h3_l4_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_mcrx_hgr-cbd-athletics', 4),
  ('cha_w5_h3_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_beat-boxers', 5),
  ('cha_w5_h3_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_cam-and-kenn', 6),
  ('cha_w5_h3_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_wod-my-name-out-yo-m', 7),
  ('cha_w5_h3_l8_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_deadlifts-chill', 8),
  ('cha_w5_h3_l9_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_what-would-froning-d', 9),
  ('cha_w5_h3_l10_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_row-mates-for-life', 10),
  ('cha_w5_h3_l11_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_the-frenchies', 11),
  ('cha_w5_h3_l12_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_misery-loves-company', 12),
  ('cha_w5_h3_l13_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_no-rep-no-whey', 13),
  ('cha_w5_h3_l14_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_bubba-needs-help', 14),
  ('cha_w5_h3_l15_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_thicc-and-tired', 15),
  ('cha_w5_h3_l16_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h3', 'creg_cint_untaymable', 16),
  ('cha_w5_h4_l1_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_hustle-and-muscle', 1),
  ('cha_w5_h4_l2_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_swolemates', 2),
  ('cha_w5_h4_l3_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_dnr', 3),
  ('cha_w5_h4_l4_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_grass-fed-grass-fini', 4),
  ('cha_w5_h4_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_swole-in-spirit', 5),
  ('cha_w5_h4_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_battle-born-and-worn', 6),
  ('cha_w5_h4_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_cint_dos-chanchos', 7),
  ('cha_w5_h4_l8_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_irish-wristwatch', 8),
  ('cha_w5_h4_l9_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_red', 9),
  ('cha_w5_h4_l10_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_good', 10),
  ('cha_w5_h4_l11_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_ambiguously-qualifie', 11),
  ('cha_w5_h4_l12_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_check-engine', 12),
  ('cha_w5_h4_l13_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_dad-bod-dynasty', 13),
  ('cha_w5_h4_l14_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_obsolete', 14),
  ('cha_w5_h4_l15_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_thruster-i-hardly-kn', 15),
  ('cha_w5_h4_l16_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h4', 'creg_mmint_fullertons-old-schoo', 16),
  ('cha_w5_h5_l1_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_not-fast-just-furiou', 1),
  ('cha_w5_h5_l2_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_gen-x-flex', 2),
  ('cha_w5_h5_l3_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_captain-baby', 3),
  ('cha_w5_h5_l4_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_iron-valkyrie-sister', 4),
  ('cha_w5_h5_l5_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_barbell-bros', 5),
  ('cha_w5_h5_l6_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_slay-all-day', 6),
  ('cha_w5_h5_l7_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_10-kids-later', 7),
  ('cha_w5_h5_l8_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_built-in-black', 8),
  ('cha_w5_h5_l9_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mwint_apple-bottom-cleans', 9),
  ('cha_w5_h5_l11_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mmrook_mexican-jumping-bean', 11),
  ('cha_w5_h5_l12_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mmrook_two-guys-big-thighs', 12),
  ('cha_w5_h5_l13_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mmrook_peaked-in-high-schoo', 13),
  ('cha_w5_h5_l14_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mmrook_worst-pace-scenario', 14),
  ('cha_w5_h5_l15_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h5', 'creg_mmrook_team-puma-sock', 15),
  ('cha_w5_h6_l4_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_fireside-centurions', 4),
  ('cha_w5_h6_l5_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_bustin', 5),
  ('cha_w5_h6_l6_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_super-snatch-bros', 6),
  ('cha_w5_h6_l7_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_northside-thugs-n-ha', 7),
  ('cha_w5_h6_l8_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_spud-brothers', 8),
  ('cha_w5_h6_l9_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_team-propath', 9),
  ('cha_w5_h6_l10_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_old-broken', 10),
  ('cha_w5_h6_l11_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_barbell-babes', 11),
  ('cha_w5_h6_l12_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_timmy-and-the-brain', 12),
  ('cha_w5_h6_l13_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h6', 'creg_mmrx_t-c', 13),
  ('cha_w5_h8_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_high-bar-low-bar', 3),
  ('cha_w5_h8_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_grab-em-by-the-dumbb', 4),
  ('cha_w5_h8_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_the-team-that-shall-', 5),
  ('cha_w5_h8_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_mileage-mayhem', 6),
  ('cha_w5_h8_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_fourth-and-wod', 7),
  ('cha_w5_h8_l8_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_team-nonchalant', 8),
  ('cha_w5_h8_l9_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_twin-turbo', 9),
  ('cha_w5_h8_l10_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_team-saiyan', 10),
  ('cha_w5_h8_l11_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_peter-parkers', 11),
  ('cha_w5_h8_l12_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_the-swolemates', 12),
  ('cha_w5_h8_l13_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_sugar-daddies', 13),
  ('cha_w5_h8_l14_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h8', 'creg_mint_train-town', 14),
  ('cha_w5_h9_l1_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_howen', 1),
  ('cha_w5_h9_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_summit-seekers', 2),
  ('cha_w5_h9_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_strong-independent-m', 3),
  ('cha_w5_h9_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_stratton-oakmont-cro', 4),
  ('cha_w5_h9_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_burrito-bros', 5),
  ('cha_w5_h9_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_burpees-and-biscuits', 6),
  ('cha_w5_h9_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mint_pupsiki', 7),
  ('cha_w5_h9_l9_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_the-team-the-team-go', 9),
  ('cha_w5_h9_l10_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_young-bull-old-goat', 10),
  ('cha_w5_h9_l11_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_sweaty-and-regrety', 11),
  ('cha_w5_h9_l12_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_brown-and-down', 12),
  ('cha_w5_h9_l13_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_gym-bruvz', 13),
  ('cha_w5_h9_l14_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_rowing-pains', 14),
  ('cha_w5_h9_l15_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_rice-beans', 15),
  ('cha_w5_h9_l16_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h9', 'creg_mrook_last-minute-lifters', 16),
  ('cha_w5_h10_l1_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_floss-n-fades', 1),
  ('cha_w5_h10_l2_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_look-wod-you-made-me', 2),
  ('cha_w5_h10_l3_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_mother-hustlers', 3),
  ('cha_w5_h10_l4_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_grit-grace', 4),
  ('cha_w5_h10_l5_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_dog-mom-duo', 5),
  ('cha_w5_h10_l6_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_oh-snatch', 6),
  ('cha_w5_h10_l7_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_masters-in-motion', 7),
  ('cha_w5_h10_l8_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_we-were-on-a-break', 8),
  ('cha_w5_h10_l9_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_kettlebelles', 9),
  ('cha_w5_h10_l10_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_bend-and-snap', 10),
  ('cha_w5_h10_l11_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_muscle-milkmaids', 11),
  ('cha_w5_h10_l12_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_flex-appeal', 12),
  ('cha_w5_h10_l13_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_the-cougar-and-the-k', 13),
  ('cha_w5_h10_l14_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_2-snatched-2-quit', 14),
  ('cha_w5_h10_l15_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h10', 'creg_wrook_chalk-dirty-to-me', 15),
  ('cha_w5_h11_l1_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_critter-gitters', 1),
  ('cha_w5_h11_l2_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_double-wonders', 2),
  ('cha_w5_h11_l3_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_down-bad-crying-at-t', 3),
  ('cha_w5_h11_l4_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_flexual-healing', 4),
  ('cha_w5_h11_l5_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_gabz-and-make-it-rai', 5),
  ('cha_w5_h11_l6_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_grins-and-wins', 6),
  ('cha_w5_h11_l7_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_hot-mom-era', 7),
  ('cha_w5_h11_l8_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_hustle-muscle', 8),
  ('cha_w5_h11_l9_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_long-distance-lifter', 9),
  ('cha_w5_h11_l10_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_misplaced-masters', 10),
  ('cha_w5_h11_l11_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_pr-or-er', 11),
  ('cha_w5_h11_l12_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_social-hour', 12),
  ('cha_w5_h11_l13_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_the-power-puff-girls', 13),
  ('cha_w5_h11_l14_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_thunder-lightning', 14),
  ('cha_w5_h11_l15_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_verdant-vixens', 15),
  ('cha_w5_h11_l16_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h11', 'creg_wint_woddesses', 16),
  ('cha_w5_h12_l2_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_hot-mess-express', 2),
  ('cha_w5_h12_l3_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_power-princesses', 3),
  ('cha_w5_h12_l4_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_m-m-mayhem', 4),
  ('cha_w5_h12_l5_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_m-m', 5),
  ('cha_w5_h12_l6_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_northside-naptime-ni', 6),
  ('cha_w5_h12_l7_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_jacked-in-the-box', 7),
  ('cha_w5_h12_l8_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_hannah-montana', 8),
  ('cha_w5_h12_l9_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_naddy-the-baddies', 9),
  ('cha_w5_h12_l10_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_o-doyle-rules', 10),
  ('cha_w5_h12_l11_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_snatching-with-siren', 11),
  ('cha_w5_h12_l12_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_arbor-mcfit', 12),
  ('cha_w5_h12_l13_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_quad-squad', 13),
  ('cha_w5_h12_l14_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_supermom-squad', 14),
  ('cha_w5_h12_l15_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w5_h12', 'creg_wrx_not-dying-just-gesta', 15);

-- Workout 6 Heat Assignments
INSERT OR REPLACE INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  ('cha_w6_h1_l1_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_richardson-rebels', 1),
  ('cha_w6_h1_l2_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_feel-the-mcburn', 2),
  ('cha_w6_h1_l3_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_sin-miedo', 3),
  ('cha_w6_h1_l4_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_let-em-cook', 4),
  ('cha_w6_h1_l5_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_breakfast-dinner', 5),
  ('cha_w6_h1_l6_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_geweck-yourselves', 6),
  ('cha_w6_h1_l7_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_the-rex-factor', 7),
  ('cha_w6_h1_l8_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_sore-losers', 8),
  ('cha_w6_h1_l9_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_cheez-it-extra-toast', 9),
  ('cha_w6_h1_l10_crook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_crook_fitz-and-furious', 10),
  ('cha_w6_h1_l11_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_mcint_i-ve-got-a-headache', 11),
  ('cha_w6_h1_l12_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_mcint_plus-ultra', 12),
  ('cha_w6_h1_l13_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_mcint_the-zzzs', 13),
  ('cha_w6_h1_l14_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_mcint_team-nancy-resting-b', 14),
  ('cha_w6_h1_l15_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_mcint_squat-me-baby', 15),
  ('cha_w6_h1_l16_mcint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h1', 'creg_mcint_blue-eyed-beasts', 16),
  ('cha_w6_h2_l2_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_daddy-with-a-phatty', 2),
  ('cha_w6_h2_l3_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_queen-and-jerk', 3),
  ('cha_w6_h2_l4_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_gcs-3', 4),
  ('cha_w6_h2_l5_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_verdantside', 5),
  ('cha_w6_h2_l6_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_team-day-ones', 6),
  ('cha_w6_h2_l7_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_goofy-goobers', 7),
  ('cha_w6_h2_l8_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_em-and-m', 8),
  ('cha_w6_h2_l9_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_mules-of-co-pain', 9),
  ('cha_w6_h2_l10_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_96-chicago-bulls', 10),
  ('cha_w6_h2_l11_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_trident-athletics', 11),
  ('cha_w6_h2_l12_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_ag-fan-club', 12),
  ('cha_w6_h2_l13_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_rodeo-rhymers', 13),
  ('cha_w6_h2_l14_crx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h2', 'creg_crx_two-toned-thunder', 14),
  ('cha_w6_h3_l1_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_mcrx_aged-to-perfection', 1),
  ('cha_w6_h3_l2_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_mcrx_nooners', 2),
  ('cha_w6_h3_l3_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_mcrx_sigma-and-gyat', 3),
  ('cha_w6_h3_l4_mcrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_mcrx_hgr-cbd-athletics', 4),
  ('cha_w6_h3_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_beat-boxers', 5),
  ('cha_w6_h3_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_cam-and-kenn', 6),
  ('cha_w6_h3_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_wod-my-name-out-yo-m', 7),
  ('cha_w6_h3_l8_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_deadlifts-chill', 8),
  ('cha_w6_h3_l9_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_what-would-froning-d', 9),
  ('cha_w6_h3_l10_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_row-mates-for-life', 10),
  ('cha_w6_h3_l11_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_the-frenchies', 11),
  ('cha_w6_h3_l12_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_misery-loves-company', 12),
  ('cha_w6_h3_l13_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_no-rep-no-whey', 13),
  ('cha_w6_h3_l14_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_bubba-needs-help', 14),
  ('cha_w6_h3_l15_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_thicc-and-tired', 15),
  ('cha_w6_h3_l16_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h3', 'creg_cint_untaymable', 16),
  ('cha_w6_h4_l1_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_hustle-and-muscle', 1),
  ('cha_w6_h4_l2_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_swolemates', 2),
  ('cha_w6_h4_l3_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_dnr', 3),
  ('cha_w6_h4_l4_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_grass-fed-grass-fini', 4),
  ('cha_w6_h4_l5_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_swole-in-spirit', 5),
  ('cha_w6_h4_l6_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_battle-born-and-worn', 6),
  ('cha_w6_h4_l7_cint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_cint_dos-chanchos', 7),
  ('cha_w6_h4_l8_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_irish-wristwatch', 8),
  ('cha_w6_h4_l9_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_red', 9),
  ('cha_w6_h4_l10_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_good', 10),
  ('cha_w6_h4_l11_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_ambiguously-qualifie', 11),
  ('cha_w6_h4_l12_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_check-engine', 12),
  ('cha_w6_h4_l13_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_dad-bod-dynasty', 13),
  ('cha_w6_h4_l14_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_obsolete', 14),
  ('cha_w6_h4_l15_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_thruster-i-hardly-kn', 15),
  ('cha_w6_h4_l16_mmint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h4', 'creg_mmint_fullertons-old-schoo', 16),
  ('cha_w6_h5_l1_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_not-fast-just-furiou', 1),
  ('cha_w6_h5_l2_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_gen-x-flex', 2),
  ('cha_w6_h5_l3_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_captain-baby', 3),
  ('cha_w6_h5_l4_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_iron-valkyrie-sister', 4),
  ('cha_w6_h5_l5_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_barbell-bros', 5),
  ('cha_w6_h5_l6_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_slay-all-day', 6),
  ('cha_w6_h5_l7_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_10-kids-later', 7),
  ('cha_w6_h5_l8_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_built-in-black', 8),
  ('cha_w6_h5_l9_mwint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mwint_apple-bottom-cleans', 9),
  ('cha_w6_h5_l11_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mmrook_mexican-jumping-bean', 11),
  ('cha_w6_h5_l12_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mmrook_two-guys-big-thighs', 12),
  ('cha_w6_h5_l13_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mmrook_peaked-in-high-schoo', 13),
  ('cha_w6_h5_l14_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mmrook_worst-pace-scenario', 14),
  ('cha_w6_h5_l15_mmrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h5', 'creg_mmrook_team-puma-sock', 15),
  ('cha_w6_h6_l4_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_fireside-centurions', 4),
  ('cha_w6_h6_l5_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_bustin', 5),
  ('cha_w6_h6_l6_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_super-snatch-bros', 6),
  ('cha_w6_h6_l7_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_northside-thugs-n-ha', 7),
  ('cha_w6_h6_l8_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_spud-brothers', 8),
  ('cha_w6_h6_l9_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_team-propath', 9),
  ('cha_w6_h6_l10_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_old-broken', 10),
  ('cha_w6_h6_l11_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_barbell-babes', 11),
  ('cha_w6_h6_l12_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_timmy-and-the-brain', 12),
  ('cha_w6_h6_l13_mmrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h6', 'creg_mmrx_t-c', 13),
  ('cha_w6_h8_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_high-bar-low-bar', 3),
  ('cha_w6_h8_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_grab-em-by-the-dumbb', 4),
  ('cha_w6_h8_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_the-team-that-shall-', 5),
  ('cha_w6_h8_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_mileage-mayhem', 6),
  ('cha_w6_h8_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_fourth-and-wod', 7),
  ('cha_w6_h8_l8_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_team-nonchalant', 8),
  ('cha_w6_h8_l9_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_twin-turbo', 9),
  ('cha_w6_h8_l10_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_team-saiyan', 10),
  ('cha_w6_h8_l11_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_peter-parkers', 11),
  ('cha_w6_h8_l12_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_the-swolemates', 12),
  ('cha_w6_h8_l13_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_sugar-daddies', 13),
  ('cha_w6_h8_l14_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h8', 'creg_mint_train-town', 14),
  ('cha_w6_h9_l1_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_howen', 1),
  ('cha_w6_h9_l2_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_summit-seekers', 2),
  ('cha_w6_h9_l3_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_strong-independent-m', 3),
  ('cha_w6_h9_l4_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_stratton-oakmont-cro', 4),
  ('cha_w6_h9_l5_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_burrito-bros', 5),
  ('cha_w6_h9_l6_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_burpees-and-biscuits', 6),
  ('cha_w6_h9_l7_mint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mint_pupsiki', 7),
  ('cha_w6_h9_l9_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_the-team-the-team-go', 9),
  ('cha_w6_h9_l10_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_young-bull-old-goat', 10),
  ('cha_w6_h9_l11_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_sweaty-and-regrety', 11),
  ('cha_w6_h9_l12_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_brown-and-down', 12),
  ('cha_w6_h9_l13_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_gym-bruvz', 13),
  ('cha_w6_h9_l14_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_rowing-pains', 14),
  ('cha_w6_h9_l15_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_rice-beans', 15),
  ('cha_w6_h9_l16_mrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h9', 'creg_mrook_last-minute-lifters', 16),
  ('cha_w6_h10_l1_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_floss-n-fades', 1),
  ('cha_w6_h10_l2_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_look-wod-you-made-me', 2),
  ('cha_w6_h10_l3_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_mother-hustlers', 3),
  ('cha_w6_h10_l4_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_grit-grace', 4),
  ('cha_w6_h10_l5_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_dog-mom-duo', 5),
  ('cha_w6_h10_l6_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_oh-snatch', 6),
  ('cha_w6_h10_l7_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_masters-in-motion', 7),
  ('cha_w6_h10_l8_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_we-were-on-a-break', 8),
  ('cha_w6_h10_l9_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_kettlebelles', 9),
  ('cha_w6_h10_l10_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_bend-and-snap', 10),
  ('cha_w6_h10_l11_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_muscle-milkmaids', 11),
  ('cha_w6_h10_l12_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_flex-appeal', 12),
  ('cha_w6_h10_l13_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_the-cougar-and-the-k', 13),
  ('cha_w6_h10_l14_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_2-snatched-2-quit', 14),
  ('cha_w6_h10_l15_wrook', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h10', 'creg_wrook_chalk-dirty-to-me', 15),
  ('cha_w6_h11_l1_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_critter-gitters', 1),
  ('cha_w6_h11_l2_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_double-wonders', 2),
  ('cha_w6_h11_l3_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_down-bad-crying-at-t', 3),
  ('cha_w6_h11_l4_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_flexual-healing', 4),
  ('cha_w6_h11_l5_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_gabz-and-make-it-rai', 5),
  ('cha_w6_h11_l6_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_grins-and-wins', 6),
  ('cha_w6_h11_l7_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_hot-mom-era', 7),
  ('cha_w6_h11_l8_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_hustle-muscle', 8),
  ('cha_w6_h11_l9_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_long-distance-lifter', 9),
  ('cha_w6_h11_l10_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_misplaced-masters', 10),
  ('cha_w6_h11_l11_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_pr-or-er', 11),
  ('cha_w6_h11_l12_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_social-hour', 12),
  ('cha_w6_h11_l13_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_the-power-puff-girls', 13),
  ('cha_w6_h11_l14_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_thunder-lightning', 14),
  ('cha_w6_h11_l15_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_verdant-vixens', 15),
  ('cha_w6_h11_l16_wint', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h11', 'creg_wint_woddesses', 16),
  ('cha_w6_h12_l2_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_hot-mess-express', 2),
  ('cha_w6_h12_l3_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_power-princesses', 3),
  ('cha_w6_h12_l4_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_m-m-mayhem', 4),
  ('cha_w6_h12_l5_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_m-m', 5),
  ('cha_w6_h12_l6_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_northside-naptime-ni', 6),
  ('cha_w6_h12_l7_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_jacked-in-the-box', 7),
  ('cha_w6_h12_l8_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_hannah-montana', 8),
  ('cha_w6_h12_l9_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_naddy-the-baddies', 9),
  ('cha_w6_h12_l10_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_o-doyle-rules', 10),
  ('cha_w6_h12_l11_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_snatching-with-siren', 11),
  ('cha_w6_h12_l12_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_arbor-mcfit', 12),
  ('cha_w6_h12_l13_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_quad-squad', 13),
  ('cha_w6_h12_l14_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_supermom-squad', 14),
  ('cha_w6_h12_l15_wrx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w6_h12', 'creg_wrx_not-dying-just-gesta', 15);

-- ============================================
-- SCHEDULE REFERENCE FROM COMPETITION CORNER API
-- ============================================
-- Friday October 10, 2025:
--   Workout #1: Sawtooth - 09:00 AM - 12:33 PM
--   Workout #2: Steelhead - 01:06 PM - 04:03 PM
--   Workout #3: Spud Nation - 04:36 PM - 07:09 PM
--
-- Saturday October 11, 2025:
--   Workout #4: Bronco - 08:30 AM - 11:03 AM
--   Workout #5: Vandal - 11:36 AM - 03:33 PM
--   Workout #6: Mountain West Tommy V - 04:06 PM - 07:03 PM
--
-- HEAT SCHEDULE (per workout, 18 min intervals):
-- Heat 1:  09:00 AM - Co-Ed Rookie + Masters Co-Ed Intermediate
-- Heat 2:  09:18 AM - Co-Ed RX
-- Heat 3:  09:36 AM - Masters Co-Ed RX + Co-Ed Intermediate
-- Heat 4:  09:54 AM - Co-Ed Intermediate + Masters Men's Intermediate
-- Heat 5:  10:12 AM - Masters Women's Intermediate + Masters Men's Rookie
-- Heat 6:  10:30 AM - Masters Men's RX + Men's RX
-- Heat 7:  10:48 AM - Men's RX
-- Heat 8:  11:06 AM - Men's Intermediate
-- Heat 9:  11:24 AM - Men's Intermediate + Men's Rookie
-- Heat 10: 11:42 AM - Women's Rookie
-- Heat 11: 12:00 PM - Women's Intermediate
-- Heat 12: 12:18 PM - Women's RX
-- ============================================
