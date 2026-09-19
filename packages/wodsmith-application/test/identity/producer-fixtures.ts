import type { LegacyCompetitionIdentitySnapshot } from "../../src/identity"

// Database projections, including defaults, from createCompetitionFn before
// division settings are saved. Unrelated scaling levels must not be adopted.
export const createdCompetition: LegacyCompetitionIdentitySnapshot = {
  competition: {
    id: "comp_fixture",
    organizingTeamId: "team_organizer",
    competitionTeamId: "team_access",
    name: "Fixture competition",
  },
  teams: [
    {
      id: "team_organizer",
      name: "Organizer",
      type: "gym",
      isPersonalTeam: false,
      personalTeamOwnerId: null,
      parentOrganizationId: null,
      competitionMetadata: null,
    },
    {
      id: "team_access",
      name: "Athletes",
      type: "competition_event",
      isPersonalTeam: false,
      personalTeamOwnerId: null,
      parentOrganizationId: "team_organizer",
      competitionMetadata: null,
    },
  ],
  tracks: [],
  events: [],
  eventConfigurations: [],
  selectedScalingGroupId: null,
  scalingLevels: [
    {
      id: "slvl_unselected",
      scalingGroupId: "sgrp_other",
      label: "Other",
      position: 0,
      teamSize: 1,
    },
  ],
  divisionConfigurations: [],
  registrations: [],
  memberships: [],
}

// Nullable competition_registrations.divisionId is the persisted open scope
// handled by registration transfers and result commands.
export const openRegistration: LegacyCompetitionIdentitySnapshot = {
  ...createdCompetition,
  registrations: [
    {
      id: "creg_open",
      eventId: "comp_fixture",
      userId: "usr_captain",
      divisionId: null,
      status: "active",
      athleteTeamId: null,
      captainUserId: null,
    },
  ],
}

// registerForCompetition writes metadata, one captain registration and captain
// membership; accepted teammates add member memberships to this same squad.
export const runtimeSquad: LegacyCompetitionIdentitySnapshot = {
  ...createdCompetition,
  selectedScalingGroupId: "sgrp_fixture",
  scalingLevels: [
    {
      id: "slvl_pairs",
      scalingGroupId: "sgrp_fixture",
      label: "Pairs",
      position: 0,
      teamSize: 2,
    },
    {
      id: "slvl_scaled_pairs",
      scalingGroupId: "sgrp_fixture",
      label: "Scaled Pairs",
      position: 1,
      teamSize: 2,
    },
  ],
  teams: [
    ...createdCompetition.teams,
    {
      id: "team_squad",
      name: "Pair",
      type: "competition_team",
      isPersonalTeam: false,
      personalTeamOwnerId: null,
      parentOrganizationId: "team_access",
      competitionMetadata:
        '{"competitionId":"comp_fixture","divisionId":"slvl_pairs"}',
    },
  ],
  registrations: [
    {
      id: "creg_captain",
      eventId: "comp_fixture",
      userId: "usr_captain",
      divisionId: "slvl_pairs",
      status: "active",
      athleteTeamId: "team_squad",
      captainUserId: "usr_captain",
    },
  ],
  memberships: [
    {
      teamId: "team_squad",
      userId: "usr_captain",
      roleId: "captain",
      isActive: true,
    },
    {
      teamId: "team_squad",
      userId: "usr_member",
      roleId: "member",
      isActive: true,
    },
  ],
}

// transferRegistrationDivisionFn updates the registration, not team metadata.
export const transferredSquad: LegacyCompetitionIdentitySnapshot = {
  ...runtimeSquad,
  registrations: runtimeSquad.registrations.map((row) => ({
    ...row,
    divisionId: "slvl_scaled_pairs",
  })),
}

// generateDemoCompetitionFn leaves metadata at its NULL default, writes every
// membership as member, and registers each member with the same captainUserId.
export const demoSquad: LegacyCompetitionIdentitySnapshot = {
  ...runtimeSquad,
  teams: runtimeSquad.teams.map((row) => ({
    ...row,
    competitionMetadata: null,
  })),
  memberships: runtimeSquad.memberships!.map((row) => ({
    ...row,
    roleId: "member",
  })),
  registrations: [
    {
      ...runtimeSquad.registrations[0]!,
      id: "creg_member",
      userId: "usr_member",
    },
    runtimeSquad.registrations[0]!,
  ],
}

// Actual persisted IDs from seeders/10-programming.ts and 11-competition.ts,
// including the parent-child event shape and a configured submission window.
export const seededEvents: LegacyCompetitionIdentitySnapshot = {
  ...createdCompetition,
  competition: {
    ...createdCompetition.competition,
    id: "comp_online_qualifier_2026",
  },
  tracks: [
    {
      id: "track_online_qualifier_2026",
      competitionId: "comp_online_qualifier_2026",
    },
  ],
  events: [
    {
      id: "tw_online_event1",
      trackId: "track_online_qualifier_2026",
      parentEventId: null,
      name: "Fran",
    },
    {
      id: "tw_online_event4_parent",
      trackId: "track_online_qualifier_2026",
      parentEventId: null,
      name: "Couplet",
    },
    {
      id: "tw_online_event4_sprint",
      trackId: "track_online_qualifier_2026",
      parentEventId: "tw_online_event4_parent",
      name: "Sprint",
    },
  ],
  eventConfigurations: [
    {
      id: "cevt_online_event1",
      competitionId: "comp_online_qualifier_2026",
      trackWorkoutId: "tw_online_event1",
      submissionOpensAt: "2026-09-01 00:00:00",
      submissionClosesAt: "2026-09-08 00:00:00",
    },
  ],
}
