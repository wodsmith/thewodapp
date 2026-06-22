// @lat: [[crew#Series Crew Pools]]
import { describe, expect, it } from "vitest"
import {
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_TYPE,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
} from "../../db/schemas/crew-volunteer-intelligence"
import { buildSeriesCrewPoolViewModel } from "./series-crew-pools"

const competitions = [
  {
    id: "comp_alpha",
    name: "Alpha Throwdown",
    slug: "alpha",
    startDate: "2026-03-01",
    endDate: "2026-03-02",
  },
  {
    id: "comp_bravo",
    name: "Bravo Throwdown",
    slug: "bravo",
    startDate: "2026-04-01",
    endDate: "2026-04-02",
  },
]

describe("series crew pools", () => {
  it("dedupes volunteers across same-group competitions and summarizes factual history", () => {
    const pool = buildSeriesCrewPoolViewModel({
      organizerTeamId: "team_organizer",
      groupId: "cgrp_series",
      competitions,
      selectedCompetitionIds: ["comp_bravo"],
      roster: [
        {
          rosterVolunteerId: "comp_alpha:membership:tmem_ada_alpha",
          competitionId: "comp_alpha",
          volunteerName: "Ada Lovelace",
          rosterStatus: "active",
          availability: "morning",
          roleTypes: ["judge"],
        },
        {
          rosterVolunteerId: "comp_bravo:membership:tmem_ada_bravo",
          competitionId: "comp_bravo",
          volunteerName: "Ada Lovelace",
          rosterStatus: "active",
          availability: "all_day",
          roleTypes: ["judge", "staff"],
        },
      ],
      identities: [
        {
          id: "cvid_ada",
          teamId: "team_organizer",
          rosterVolunteerId: "comp_alpha:membership:tmem_ada_alpha",
        },
        {
          id: "cvid_ada",
          teamId: "team_organizer",
          rosterVolunteerId: "comp_bravo:membership:tmem_ada_bravo",
        },
      ],
      historyEvents: [
        {
          identityId: "cvid_ada",
          teamId: "team_organizer",
          competitionId: "comp_alpha",
          groupId: "cgrp_series",
          competitionName: "Alpha Throwdown",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "judge",
          occurredAt: "2026-03-01T15:00:00.000Z",
        },
        {
          identityId: "cvid_ada",
          teamId: "team_organizer",
          competitionId: "comp_bravo",
          groupId: "cgrp_series",
          competitionName: "Bravo Throwdown",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "staff",
          occurredAt: "2026-04-01T15:00:00.000Z",
        },
      ],
      credentials: [
        {
          identityId: "cvid_ada",
          teamId: "team_organizer",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.JUDGE_COURSE,
          credentialLabel: "L1 Judge",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
      ],
    })

    expect(pool.summary).toMatchObject({
      totalVolunteers: 1,
      rosterPlacements: 2,
      selectedCompetitions: 1,
      volunteersInSelectedCompetitions: 1,
      volunteersWithHistory: 1,
      safeCredentialCount: 1,
    })
    expect(pool.entries[0]).toMatchObject({
      volunteerName: "Ada Lovelace",
      selectedCompetitionIds: ["comp_bravo"],
      priorEventCount: 1,
      lastEvent: {
        competitionId: "comp_alpha",
        label: "Alpha Throwdown",
      },
      reliability: {
        signedUp: 0,
        imported: 0,
        assigned: 0,
        confirmed: 1,
        declined: 0,
        changeRequested: 0,
        noShow: 0,
        completed: 0,
      },
      credentials: [
        {
          credentialType: "judge_course",
          credentialLabel: "L1 Judge",
          status: "verified",
        },
      ],
    })
  })

  it("keeps history scoped to the same organizer and same competition group", () => {
    const pool = buildSeriesCrewPoolViewModel({
      organizerTeamId: "team_organizer",
      groupId: "cgrp_series",
      competitions,
      selectedCompetitionIds: ["comp_alpha"],
      roster: [
        {
          rosterVolunteerId: "comp_alpha:membership:tmem_grace",
          competitionId: "comp_alpha",
          volunteerName: "Grace Hopper",
          rosterStatus: "active",
          availability: null,
          roleTypes: ["general"],
        },
      ],
      identities: [
        {
          id: "cvid_grace",
          teamId: "team_organizer",
          rosterVolunteerId: "comp_alpha:membership:tmem_grace",
        },
      ],
      historyEvents: [
        {
          identityId: "cvid_grace",
          teamId: "team_organizer",
          competitionId: "comp_other_group",
          groupId: "cgrp_other",
          competitionName: "Other Series",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "judge",
          occurredAt: "2026-02-01T12:00:00.000Z",
        },
        {
          identityId: "cvid_grace",
          teamId: "team_other",
          competitionId: "comp_bravo",
          groupId: "cgrp_series",
          competitionName: "Other Organizer",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "judge",
          occurredAt: "2026-03-01T12:00:00.000Z",
        },
      ],
      credentials: [
        {
          identityId: "cvid_grace",
          teamId: "team_other",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.MEDICAL,
          credentialLabel: "Private EMT",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
      ],
    })

    expect(pool.entries[0]?.priorEventCount).toBe(0)
    expect(pool.entries[0]?.lastEvent).toBeNull()
    expect(pool.entries[0]?.credentials).toEqual([])
  })

  it("omits raw contact and private metadata while preserving safe counts", () => {
    const pool = buildSeriesCrewPoolViewModel({
      organizerTeamId: "team_organizer",
      groupId: "cgrp_series",
      competitions,
      selectedCompetitionIds: ["comp_alpha"],
      roster: [
        {
          rosterVolunteerId: "comp_alpha:invitation:tinv_katherine",
          competitionId: "comp_alpha",
          volunteerName: "Katherine Johnson",
          rosterStatus: "pending",
          availability: "afternoon",
          roleTypes: ["staff"],
        },
      ],
      identities: [
        {
          id: "cvid_katherine",
          teamId: "team_organizer",
          rosterVolunteerId: "comp_alpha:invitation:tinv_katherine",
        },
      ],
      historyEvents: [
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.SIGNED_UP,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.IMPORTED,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.ASSIGNED,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CHANGE_REQUESTED,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW,
        CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
      ].map((eventType, index) => ({
        identityId: "cvid_katherine",
        teamId: "team_organizer",
        competitionId: "comp_bravo",
        groupId: "cgrp_series",
        competitionName: "Bravo Throwdown",
        eventType,
        visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        roleType: "staff" as const,
        occurredAt: `2026-04-0${index + 1}T12:00:00.000Z`,
      })),
      credentials: [
        {
          identityId: "cvid_katherine",
          teamId: "team_organizer",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.MEDICAL,
          credentialLabel: "EMT",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
        {
          identityId: "cvid_katherine",
          teamId: "team_organizer",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.EQUIPMENT,
          credentialLabel: "Revoked rigging",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.REVOKED,
          visibilityScope:
            CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
      ],
    })

    expect(pool.entries[0]?.reliability).toEqual({
      signedUp: 1,
      imported: 1,
      assigned: 1,
      confirmed: 1,
      declined: 1,
      changeRequested: 1,
      noShow: 1,
      completed: 1,
    })
    expect(pool.entries[0]?.credentials).toEqual([
      {
        credentialType: "medical",
        credentialLabel: "EMT",
        status: "self_reported",
      },
    ])
    const serialized = JSON.stringify(pool)
    expect(serialized).not.toContain("katherine@example.com")
    expect(serialized).not.toContain("555")
    expect(serialized).not.toContain("internalNotes")
    expect(serialized).not.toContain("stripe")
  })
})
