import { describe, expect, it } from "vitest"

import {
  decodeCompetitionEventId,
  decodeLegacyEventConfigurationId,
  resolveLegacyCompetitionTopology,
  type LegacyCompetitionIdentitySnapshot,
} from "../../src/identity"

const ids = {
  competitionA: "comp_01COMPETITIONA",
  competitionB: "comp_01COMPETITIONB",
  organization: "team_01ORGANIZATION",
  accessTeam: "team_01COMPETITIONACCESS",
  trackA: "ptrk_01TRACKA",
  trackB: "ptrk_01TRACKB",
  eventA: "trwk_01EVENTA",
  eventB: "trwk_01EVENTB",
  eventConfiguration: "cevt_01CONFIGA",
  scalingGroup: "sgrp_01DIVISIONS",
  foreignScalingGroup: "sgrp_01FOREIGN",
  divisionA: "slvl_01DIVISIONA",
  divisionB: "slvl_01DIVISIONB",
  registrationA: "creg_01REGISTRATIONA",
  registrationB: "creg_01REGISTRATIONB",
  athlete: "usr_01ATHLETE",
  secondAthlete: "usr_01SECONDATHLETE",
  runtimeWorkspace: "team_01RUNTIMEWORKSPACE",
  seededWorkspace: "team_01SEEDEDWORKSPACE",
} as const

function validSnapshot(
  overrides: Partial<LegacyCompetitionIdentitySnapshot> = {},
): LegacyCompetitionIdentitySnapshot {
  return {
    competition: {
      id: ids.competitionA,
      organizingTeamId: ids.organization,
      competitionTeamId: ids.accessTeam,
      name: "Fall Throwdown",
    },
    teams: [
      {
        id: ids.organization,
        name: "Example Fitness",
        type: "gym",
        isPersonalTeam: false,
        personalTeamOwnerId: null,
        parentOrganizationId: null,
        competitionMetadata: null,
      },
      {
        id: ids.accessTeam,
        name: "Fall Throwdown athletes",
        type: "competition_event",
        isPersonalTeam: false,
        personalTeamOwnerId: null,
        parentOrganizationId: ids.organization,
        competitionMetadata: null,
      },
    ],
    tracks: [{ id: ids.trackA, competitionId: ids.competitionA }],
    events: [
      {
        id: ids.eventA,
        trackId: ids.trackA,
        parentEventId: null,
        name: "Event 1",
      },
    ],
    eventConfigurations: [
      {
        id: ids.eventConfiguration,
        competitionId: ids.competitionA,
        trackWorkoutId: ids.eventA,
        submissionOpensAt: "2026-10-01T00:00:00.000Z",
        submissionClosesAt: "2026-10-08T00:00:00.000Z",
      },
    ],
    selectedScalingGroupId: ids.scalingGroup,
    scalingLevels: [
      {
        id: ids.divisionA,
        scalingGroupId: ids.scalingGroup,
        label: "RX",
        position: 0,
        teamSize: 1,
      },
      {
        id: ids.divisionB,
        scalingGroupId: ids.scalingGroup,
        label: "Scaled",
        position: 1,
        teamSize: 1,
      },
    ],
    divisionConfigurations: [],
    registrations: [
      {
        id: ids.registrationA,
        eventId: ids.competitionA,
        userId: ids.athlete,
        divisionId: ids.divisionA,
        status: "active",
        athleteTeamId: null,
      },
      {
        id: ids.registrationB,
        eventId: ids.competitionA,
        userId: ids.athlete,
        divisionId: ids.divisionB,
        status: "active",
        athleteTeamId: null,
      },
    ],
    ...overrides,
  }
}

describe("legacy competition identity boundary", () => {
  // @lat: [[identity#Canonical identifiers#Distinguishes event occurrences from window configuration]]
  it("distinguishes canonical events from legacy window configuration IDs", () => {
    expect(decodeCompetitionEventId(ids.eventA)).toEqual({
      ok: true,
      value: ids.eventA,
    })
    expect(decodeLegacyEventConfigurationId(ids.eventConfiguration)).toEqual({
      ok: true,
      value: ids.eventConfiguration,
    })
    expect(decodeCompetitionEventId(ids.eventConfiguration)).toMatchObject({
      ok: false,
      error: { kind: "InvalidIdentifier", expectedPrefix: "trwk_" },
    })
    expect(decodeLegacyEventConfigurationId(ids.eventA)).toMatchObject({
      ok: false,
      error: { kind: "InvalidIdentifier", expectedPrefix: "cevt_" },
    })
  })

  // @lat: [[identity#Canonical identifiers#Normalizes both personal workspace forms]]
  it("normalizes runtime and seeded personal-team shapes", () => {
    const baseline = validSnapshot()
    const result = resolveLegacyCompetitionTopology({
      ...baseline,
      teams: [
        ...baseline.teams,
        {
          id: ids.runtimeWorkspace,
          name: "Runtime workspace",
          type: "gym",
          isPersonalTeam: true,
          personalTeamOwnerId: ids.athlete,
          parentOrganizationId: null,
          competitionMetadata: null,
        },
        {
          id: ids.seededWorkspace,
          name: "Seeded workspace",
          type: "personal",
          isPersonalTeam: true,
          personalTeamOwnerId: ids.secondAthlete,
          parentOrganizationId: null,
          competitionMetadata: null,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect([...result.value.personalWorkspaces.values()]).toMatchObject([
      { id: ids.runtimeWorkspace, ownerId: ids.athlete },
      { id: ids.seededWorkspace, ownerId: ids.secondAthlete },
    ])
  })

  // @lat: [[identity#Topology invariants#Rejects cross-competition event configuration]]
  it("rejects a window configuration attached to another competition's event", () => {
    const result = resolveLegacyCompetitionTopology(
      validSnapshot({
        tracks: [
          { id: ids.trackA, competitionId: ids.competitionA },
          { id: ids.trackB, competitionId: ids.competitionB },
        ],
        events: [
          {
            id: ids.eventB,
            trackId: ids.trackB,
            parentEventId: null,
            name: "Foreign event",
          },
        ],
        eventConfigurations: [
          {
            id: ids.eventConfiguration,
            competitionId: ids.competitionA,
            trackWorkoutId: ids.eventB,
            submissionOpensAt: null,
            submissionClosesAt: null,
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "IdentityCorruption",
        code: "CROSS_COMPETITION_EVENT",
        source: {
          table: "competition_events",
          rowId: ids.eventConfiguration,
        },
      },
    })
  })

  // @lat: [[identity#Topology invariants#Rejects foreign divisions]]
  it("rejects a registration whose division is outside the competition", () => {
    const result = resolveLegacyCompetitionTopology(
      validSnapshot({
        scalingLevels: [
          {
            id: ids.divisionA,
            scalingGroupId: ids.scalingGroup,
            label: "RX",
            position: 0,
            teamSize: 1,
          },
          {
            id: ids.divisionB,
            scalingGroupId: ids.foreignScalingGroup,
            label: "Foreign division",
            position: 0,
            teamSize: 1,
          },
        ],
        registrations: [
          {
            id: ids.registrationA,
            eventId: ids.competitionA,
            userId: ids.athlete,
            divisionId: ids.divisionB,
            status: "active",
            athleteTeamId: null,
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "IdentityCorruption",
        code: "DIVISION_OUTSIDE_COMPETITION",
        source: {
          table: "competition_registrations",
          rowId: ids.registrationA,
        },
      },
    })
  })

  // @lat: [[identity#Topology invariants#Preserves independent multi-division participation]]
  it("preserves independent registrations for one athlete", () => {
    const result = resolveLegacyCompetitionTopology(validSnapshot())

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect([...result.value.registrations.values()]).toMatchObject([
      {
        id: ids.registrationA,
        competitionId: ids.competitionA,
        divisionId: ids.divisionA,
        participation: { kind: "individual", athleteId: ids.athlete },
      },
      {
        id: ids.registrationB,
        competitionId: ids.competitionA,
        divisionId: ids.divisionB,
        participation: { kind: "individual", athleteId: ids.athlete },
      },
    ])
  })

  // @lat: [[identity#Topology invariants#Retains access while another registration is active]]
  it("retains participant access when one of two registrations is removed", () => {
    const baseline = validSnapshot()
    const result = resolveLegacyCompetitionTopology({
      ...baseline,
      registrations: baseline.registrations.map((registration) =>
        registration.id === ids.registrationA
          ? { ...registration, status: "removed" as const }
          : registration,
      ),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const registrations = [...result.value.registrations.values()]
    expect(
      registrations.find((registration) => registration.id === ids.registrationA),
    ).toMatchObject({ state: { kind: "removed" } })
    expect(
      registrations.find((registration) => registration.id === ids.registrationB),
    ).toMatchObject({ state: { kind: "active" } })
    expect([...result.value.access.participantIds]).toEqual([ids.athlete])
  })
})
