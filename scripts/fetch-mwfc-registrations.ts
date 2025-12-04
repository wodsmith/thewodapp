/**
 * Fetch MWFC 2025 registration data from Competition Corner API
 * and generate SQL seed file
 *
 * Usage: bun scripts/fetch-mwfc-registrations.ts
 */

const WORKOUT_IDS = [
  108521, // Workout #1: Sawtooth
  108522, // Workout #2: Steelhead
  111061, // Workout #3: Spud Nation
  111063, // Workout #4: Bronco
  111064, // Workout #5: Vandal
  111065, // Workout #6: Mountain West Tommy V
];

const EVENT_ID = 15905;

interface Station {
  station: number;
  participantId: number;
  divisionId: number;
  division: string;
  divisionColor: string;
  divisionFormat: string;
  avatarPath: string | null;
  participantName: string;
  teammates: string;
  affiliate: string;
  instagram: string | null;
  countryShortCode: string | null;
}

interface Heat {
  title: string;
  id: number;
  time: string;
  endTime: string;
  warmupTime: string;
  stagingTime: string;
  size: number;
  isCurrent: boolean;
  divisions: string[];
  stations: Station[];
}

interface WorkoutInfo {
  id: number;
  format: string;
  type: string;
  name: string;
  location: string;
  start: string;
  end: string;
  date: string;
  hasHeats: boolean;
  heatGroups: number;
}

interface Division {
  key: number;
  value: string;
  format: string;
  color: string;
}

// Map Competition Corner division IDs to our scaling level IDs
const DIVISION_MAP: Record<number, string> = {
  101884: "slvl_mwfc_coed_rx",
  104732: "slvl_mwfc_coed_int",
  104733: "slvl_mwfc_coed_rookie",
  104734: "slvl_mwfc_mens_rx",
  104736: "slvl_mwfc_mens_int",
  104737: "slvl_mwfc_mens_rookie",
  104735: "slvl_mwfc_womens_rx",
  104738: "slvl_mwfc_womens_int",
  104739: "slvl_mwfc_womens_rookie",
  106123: "slvl_mwfc_masters_coed_rx",
  106124: "slvl_mwfc_masters_coed_int",
  104740: "slvl_mwfc_masters_mens_rx",
  104741: "slvl_mwfc_masters_mens_int",
  104744: "slvl_mwfc_masters_womens_int",
  104742: "slvl_mwfc_masters_mens_rookie",
};

// Division short codes for ID generation
const DIVISION_CODES: Record<number, string> = {
  101884: "crx",
  104732: "cint",
  104733: "crook",
  104734: "mrx",
  104736: "mint",
  104737: "mrook",
  104735: "wrx",
  104738: "wint",
  104739: "wrook",
  106123: "mcrx",
  106124: "mcint",
  104740: "mmrx",
  104741: "mmint",
  104744: "mwint",
  104742: "mmrook",
};

async function fetchWorkoutHeats(workoutId: number): Promise<Heat[]> {
  const url = `https://competitioncorner.net/api2/v1/schedule/workout/${workoutId}`;
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch workout ${workoutId}: ${response.status}`);
  }
  return response.json();
}

async function fetchDivisions(): Promise<Division[]> {
  const url = `https://competitioncorner.net/api2/v1/lookups/${EVENT_ID}/divisions/schedule?workoutDate=2025-10-10T00:00:00`;
  console.log(`Fetching divisions...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch divisions: ${response.status}`);
  }
  return response.json();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeSQL(text: string): string {
  return text.replace(/'/g, "''");
}

function parseTeammates(teammates: string): { captain: string; partner: string } {
  // Format: "(C) FirstName LastName, FirstName LastName" or "FirstName LastName, (C) FirstName LastName"
  const parts = teammates.split(",").map((p) => p.trim());
  let captain = "";
  let partner = "";

  for (const part of parts) {
    if (part.startsWith("(C)")) {
      captain = part.replace("(C)", "").trim();
    } else {
      partner = part.replace("(C)", "").trim();
    }
  }

  return { captain, partner };
}

function generateTeamId(divisionCode: string, teamName: string): string {
  const slug = slugify(teamName).slice(0, 20);
  return `team_${divisionCode}_${slug}`;
}

function generateUserId(divisionCode: string, teamSlug: string, num: number): string {
  return `user_${divisionCode}_${teamSlug}_${num}`;
}

interface TeamData {
  participantId: number;
  divisionId: number;
  divisionCode: string;
  scalingLevelId: string;
  teamName: string;
  teamSlug: string;
  teamId: string;
  captain: { firstName: string; lastName: string };
  partner: { firstName: string; lastName: string };
  affiliate: string;
  heats: Map<number, { heatNumber: number; time: string; lane: number; heatId: number }>;
}

// Track workout IDs to our internal track workout IDs
const TRACK_WORKOUT_MAP: Record<number, string> = {
  108521: "trwk_mwfc_1",
  108522: "trwk_mwfc_2",
  111061: "trwk_mwfc_3",
  111063: "trwk_mwfc_4",
  111064: "trwk_mwfc_5",
  111065: "trwk_mwfc_6",
};

// Workout dates
const WORKOUT_DATES: Record<number, string> = {
  108521: "2025-10-10",
  108522: "2025-10-10",
  111061: "2025-10-10",
  111063: "2025-10-11",
  111064: "2025-10-11",
  111065: "2025-10-11",
};

interface HeatInfo {
  heatId: number;
  workoutId: number;
  heatNumber: number;
  time: string;
  divisionIds: Set<number>;
  assignments: { participantId: number; lane: number }[];
}

async function main() {
  console.log("Fetching MWFC 2025 registration data...\n");

  // Fetch divisions first
  const divisions = await fetchDivisions();
  console.log(`Found ${divisions.length} divisions\n`);

  // Collect all unique teams across all workouts
  const teamsMap = new Map<number, TeamData>();

  // Collect all heats for generating heat SQL
  const heatsMap = new Map<number, HeatInfo>(); // heatId -> HeatInfo

  for (const workoutId of WORKOUT_IDS) {
    const heats = await fetchWorkoutHeats(workoutId);
    console.log(`  Workout ${workoutId}: ${heats.length} heats`);

    for (const heat of heats) {
      // Track heat info (excluding Men's RX heats)
      const heatDivisionIds = new Set<number>();
      const heatAssignments: { participantId: number; lane: number }[] = [];

      for (const station of heat.stations) {
        const divisionCode = DIVISION_CODES[station.divisionId];
        const scalingLevelId = DIVISION_MAP[station.divisionId];

        if (!divisionCode || !scalingLevelId) {
          console.warn(`  Unknown division ID: ${station.divisionId}`);
          continue;
        }

        // Skip Men's RX - already in main seed file
        if (station.divisionId === 104734) {
          continue;
        }

        heatDivisionIds.add(station.divisionId);
        heatAssignments.push({
          participantId: station.participantId,
          lane: station.station,
        });

        const teamSlug = slugify(station.participantName).slice(0, 20);
        const { captain, partner } = parseTeammates(station.teammates);

        const [captainFirst, ...captainLastParts] = captain.split(" ");
        const [partnerFirst, ...partnerLastParts] = partner.split(" ");

        if (!teamsMap.has(station.participantId)) {
          teamsMap.set(station.participantId, {
            participantId: station.participantId,
            divisionId: station.divisionId,
            divisionCode,
            scalingLevelId,
            teamName: station.participantName.trim(),
            teamSlug,
            teamId: generateTeamId(divisionCode, station.participantName),
            captain: {
              firstName: captainFirst || "Unknown",
              lastName: captainLastParts.join(" ") || "Captain",
            },
            partner: {
              firstName: partnerFirst || "Unknown",
              lastName: partnerLastParts.join(" ") || "Partner",
            },
            affiliate: station.affiliate,
            heats: new Map(),
          });
        }

        // Add heat info to team
        const team = teamsMap.get(station.participantId)!;
        team.heats.set(workoutId, {
          heatNumber: parseInt(heat.title.replace("Heat ", "")),
          time: heat.time,
          lane: station.station,
          heatId: heat.id,
        });
      }

      // Store heat info if it has non-Men's-RX teams
      if (heatDivisionIds.size > 0 && heatAssignments.length > 0) {
        heatsMap.set(heat.id, {
          heatId: heat.id,
          workoutId,
          heatNumber: parseInt(heat.title.replace("Heat ", "")),
          time: heat.time,
          divisionIds: heatDivisionIds,
          assignments: heatAssignments,
        });
      }
    }
  }

  console.log(`\nFound ${teamsMap.size} unique teams (excluding Men's RX)\n`);

  // Group teams by division
  const teamsByDivision = new Map<number, TeamData[]>();
  for (const team of teamsMap.values()) {
    if (!teamsByDivision.has(team.divisionId)) {
      teamsByDivision.set(team.divisionId, []);
    }
    teamsByDivision.get(team.divisionId)!.push(team);
  }

  // Generate SQL
  let sql = `-- ============================================
-- MWFC 2025 Division Registrations Seed
-- Auto-generated from Competition Corner API
-- $350 per team registration = 35000 cents
-- ============================================
-- Generated: ${new Date().toISOString()}
-- API: https://competitioncorner.net/api2/v1/schedule/workout/{workoutId}
--
-- Fee breakdown: $350 total
-- - Platform fee (2.5%): $8.75 = 875 cents
-- - Stripe fee (2.9% + $0.30): ~$10.45 = 1045 cents
-- - Organizer net: $330.80 = 33080 cents

`;

  // Sort divisions for consistent output
  const sortedDivisions = Array.from(teamsByDivision.entries()).sort(
    ([a], [b]) => a - b
  );

  for (const [divisionId, teams] of sortedDivisions) {
    const divisionName = divisions.find((d) => d.key === divisionId)?.value || `Division ${divisionId}`;
    const divisionCode = DIVISION_CODES[divisionId];
    const scalingLevelId = DIVISION_MAP[divisionId];

    sql += `
-- ============================================
-- ${divisionName.toUpperCase()}
-- Division ID: ${scalingLevelId} (Competition Corner: ${divisionId})
-- ${teams.length} teams
-- ============================================

-- Users for ${divisionName}
INSERT INTO user (id, createdAt, updatedAt, updateCounter, firstName, lastName, email, passwordHash, emailVerified)
VALUES
`;

    const userValues: string[] = [];
    for (const team of teams) {
      const slug = team.teamSlug;
      userValues.push(
        `  ('${generateUserId(divisionCode, slug, 1)}', strftime('%s', 'now'), strftime('%s', 'now'), 1, '${escapeSQL(team.captain.firstName)}', '${escapeSQL(team.captain.lastName)}', '${slug}.1@example.com', '', 1)`
      );
      userValues.push(
        `  ('${generateUserId(divisionCode, slug, 2)}', strftime('%s', 'now'), strftime('%s', 'now'), 1, '${escapeSQL(team.partner.firstName)}', '${escapeSQL(team.partner.lastName)}', '${slug}.2@example.com', '', 1)`
      );
    }
    sql += userValues.join(",\n") + ";\n";

    // Athlete Teams
    sql += `
-- Athlete Teams for ${divisionName}
INSERT INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
`;
    const teamValues = teams.map(
      (team) =>
        `  ('${team.teamId}', strftime('%s', 'now'), strftime('%s', 'now'), 1, '${escapeSQL(team.teamName)}', '${team.teamSlug}', 'athlete', NULL)`
    );
    sql += teamValues.join(",\n") + ";\n";

    // Team Memberships
    sql += `
-- Team Memberships for ${divisionName}
INSERT INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
`;
    const membershipValues: string[] = [];
    for (const team of teams) {
      const slug = team.teamSlug;
      membershipValues.push(
        `  ('tm_${divisionCode}_${slug}_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, '${team.teamId}', '${generateUserId(divisionCode, slug, 1)}', 'admin', 1)`
      );
      membershipValues.push(
        `  ('tm_${divisionCode}_${slug}_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, '${team.teamId}', '${generateUserId(divisionCode, slug, 2)}', 'member', 1)`
      );
    }
    sql += membershipValues.join(",\n") + ";\n";

    // Event Team Memberships
    sql += `
-- Event Team Memberships for ${divisionName}
INSERT INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
`;
    const eventMembershipValues: string[] = [];
    for (const team of teams) {
      const slug = team.teamSlug;
      eventMembershipValues.push(
        `  ('tmem_evt_${divisionCode}_${slug}_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', '${generateUserId(divisionCode, slug, 1)}', 'member', 1, strftime('%s', '2025-08-01'))`
      );
      eventMembershipValues.push(
        `  ('tmem_evt_${divisionCode}_${slug}_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', '${generateUserId(divisionCode, slug, 2)}', 'member', 1, strftime('%s', '2025-08-01'))`
      );
    }
    sql += eventMembershipValues.join(",\n") + ";\n";

    // Commerce Purchases
    sql += `
-- Commerce Purchases for ${divisionName} ($350 = 35000 cents)
INSERT INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
`;
    const purchaseValues = teams.map(
      (team) =>
        `  ('cpur_${divisionCode}_${team.teamSlug}', strftime('%s', 'now'), strftime('%s', 'now'), 1, '${generateUserId(divisionCode, team.teamSlug, 1)}', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', '${scalingLevelId}', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'))`
    );
    sql += purchaseValues.join(",\n") + ";\n";

    // Competition Registrations
    sql += `
-- Competition Registrations for ${divisionName}
INSERT INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
`;
    const regValues = teams.map(
      (team) =>
        `  ('creg_${divisionCode}_${team.teamSlug}', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', '${generateUserId(divisionCode, team.teamSlug, 1)}', 'tmem_evt_${divisionCode}_${team.teamSlug}_1', '${scalingLevelId}', strftime('%s', '2025-08-01'), '${escapeSQL(team.teamName)}', '${generateUserId(divisionCode, team.teamSlug, 1)}', '${team.teamId}', 'cpur_${divisionCode}_${team.teamSlug}', 'PAID', strftime('%s', '2025-08-01'))`
    );
    sql += regValues.join(",\n") + ";\n";
  }

  // ============================================
  // COMPETITION HEATS
  // ============================================
  sql += `
-- ============================================
-- COMPETITION HEATS (All Divisions except Men's RX)
-- ============================================
`;

  // Group heats by workout for organized output
  const heatsByWorkout = new Map<number, HeatInfo[]>();
  for (const heat of heatsMap.values()) {
    if (!heatsByWorkout.has(heat.workoutId)) {
      heatsByWorkout.set(heat.workoutId, []);
    }
    heatsByWorkout.get(heat.workoutId)!.push(heat);
  }

  // Sort workouts and heats
  const sortedWorkouts = Array.from(heatsByWorkout.entries()).sort(([a], [b]) => {
    return WORKOUT_IDS.indexOf(a) - WORKOUT_IDS.indexOf(b);
  });

  for (const [workoutId, workoutHeats] of sortedWorkouts) {
    const trackWorkoutId = TRACK_WORKOUT_MAP[workoutId];
    const workoutDate = WORKOUT_DATES[workoutId];
    const workoutNum = WORKOUT_IDS.indexOf(workoutId) + 1;

    // Sort heats by heat number
    workoutHeats.sort((a, b) => a.heatNumber - b.heatNumber);

    sql += `
-- Workout ${workoutNum} Heats
INSERT OR REPLACE INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
`;

    const heatValues: string[] = [];
    for (const heat of workoutHeats) {
      // Get first division for this heat (heats can span multiple divisions)
      const firstDivisionId = Array.from(heat.divisionIds)[0];
      const scalingLevelId = DIVISION_MAP[firstDivisionId];
      const divisionNames = Array.from(heat.divisionIds)
        .map((id) => divisions.find((d) => d.key === id)?.value || `Div ${id}`)
        .join(" + ");

      // Convert time like "09:18 AM" to datetime
      const timeParts = heat.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1]);
        const minutes = timeParts[2];
        const ampm = timeParts[3].toUpperCase();
        if (ampm === "PM" && hours !== 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
        const timeStr = `${workoutDate} ${hours.toString().padStart(2, "0")}:${minutes}:00`;

        heatValues.push(
          `  ('cheat_w${workoutNum}_h${heat.heatNumber}', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', '${trackWorkoutId}', 'cvenue_mwfc_main', ${heat.heatNumber}, datetime('${timeStr}'), 15, '${scalingLevelId}', '${escapeSQL(divisionNames)}')`
        );
      }
    }
    sql += heatValues.join(",\n") + ";\n";
  }

  // ============================================
  // COMPETITION HEAT ASSIGNMENTS
  // ============================================
  sql += `
-- ============================================
-- COMPETITION HEAT ASSIGNMENTS
-- ============================================
`;

  for (const [workoutId, workoutHeats] of sortedWorkouts) {
    const workoutNum = WORKOUT_IDS.indexOf(workoutId) + 1;

    sql += `
-- Workout ${workoutNum} Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
`;

    const assignmentValues: string[] = [];
    for (const heat of workoutHeats) {
      for (const assignment of heat.assignments) {
        const team = teamsMap.get(assignment.participantId);
        if (team) {
          assignmentValues.push(
            `  ('cha_w${workoutNum}_h${heat.heatNumber}_l${assignment.lane}_${team.divisionCode}', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_w${workoutNum}_h${heat.heatNumber}', 'creg_${team.divisionCode}_${team.teamSlug}', ${assignment.lane})`
          );
        }
      }
    }
    sql += assignmentValues.join(",\n") + ";\n";
  }

  // Add schedule reference
  sql += `
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
`;

  // Write to file
  const outputPath = "mwfc-2025-division-registration-seed.sql";
  await Bun.write(outputPath, sql);
  console.log(`\nWrote ${outputPath}`);

  // Print summary
  console.log("\nSummary by division:");
  for (const [divisionId, teams] of sortedDivisions) {
    const divisionName = divisions.find((d) => d.key === divisionId)?.value || `Division ${divisionId}`;
    console.log(`  ${divisionName}: ${teams.length} teams`);
  }
}

main().catch(console.error);
