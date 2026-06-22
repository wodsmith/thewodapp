// @lat: [[crew#Strategic Moat Privacy Model]]
import { describe, expect, it } from "vitest"
import {
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_TYPE,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
} from "../../db/schemas/crew-volunteer-intelligence"
import { buildReturningVolunteerSuggestions } from "./returning-volunteers"

describe("returning volunteer suggestions", () => {
  it("summarizes same-organizer factual history without leaking raw contact fields", () => {
    const suggestions = buildReturningVolunteerSuggestions({
      organizerTeamId: "team_organizer",
      currentCompetitionId: "comp_current",
      roster: [
        {
          id: "membership:tmem_current",
          name: "Ada Lovelace",
          status: "active",
          availability: "morning",
          roleTypes: ["judge"],
        },
      ],
      identities: [
        {
          id: "cvid_ada",
          teamId: "team_organizer",
          rosterVolunteerId: "membership:tmem_current",
        },
      ],
      historyEvents: [
        {
          identityId: "cvid_ada",
          teamId: "team_organizer",
          competitionId: "comp_prior",
          competitionName: "Boise Throwdown",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "judge",
          occurredAt: "2026-05-01T12:00:00.000Z",
        },
        {
          identityId: "cvid_ada",
          teamId: "team_organizer",
          competitionId: "comp_prior",
          competitionName: "Boise Throwdown",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "medical",
          occurredAt: "2026-05-02T12:00:00.000Z",
        },
      ],
      credentials: [
        {
          identityId: "cvid_ada",
          teamId: "team_organizer",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.JUDGE_COURSE,
          credentialLabel: "L1 Judge",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
      ],
    })

    expect(suggestions).toEqual([
      {
        rosterVolunteerId: "membership:tmem_current",
        volunteerName: "Ada Lovelace",
        rosterStatus: "active",
        currentAvailability: "morning",
        currentRoleTypes: ["judge"],
        priorEventCount: 1,
        lastEvent: {
          competitionId: "comp_prior",
          label: "Boise Throwdown",
          occurredAt: "2026-05-02T12:00:00.000Z",
        },
        priorRoleTypes: ["medical", "judge"],
        reliability: {
          signedUp: 0,
          imported: 0,
          assigned: 0,
          confirmed: 1,
          declined: 0,
          changeRequested: 0,
          noShow: 0,
          completed: 1,
        },
        credentials: [
          {
            credentialType: "judge_course",
            credentialLabel: "L1 Judge",
            status: "self_reported",
          },
        ],
      },
    ])
    expect(JSON.stringify(suggestions)).not.toContain("ada@example.com")
    expect(JSON.stringify(suggestions)).not.toContain("555")
    expect(JSON.stringify(suggestions)).not.toContain("privateNote")
    expect(JSON.stringify(suggestions)).not.toContain("stripe")
  })

  it("excludes current-event and cross-organizer history", () => {
    const suggestions = buildReturningVolunteerSuggestions({
      organizerTeamId: "team_organizer",
      currentCompetitionId: "comp_current",
      roster: [
        {
          id: "invitation:tinv_current",
          name: "Grace Hopper",
          status: "pending",
          availability: null,
          roleTypes: ["general"],
        },
      ],
      identities: [
        {
          id: "cvid_grace",
          teamId: "team_organizer",
          rosterVolunteerId: "invitation:tinv_current",
        },
        {
          id: "cvid_other",
          teamId: "team_other",
          rosterVolunteerId: "invitation:tinv_current",
        },
      ],
      historyEvents: [
        {
          identityId: "cvid_grace",
          teamId: "team_organizer",
          competitionId: "comp_current",
          competitionName: "Current Event",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "general",
          occurredAt: "2026-06-21T12:00:00.000Z",
        },
        {
          identityId: "cvid_other",
          teamId: "team_other",
          competitionId: "comp_other",
          competitionName: "Other Organizer Event",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
          roleType: "judge",
          occurredAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      credentials: [],
    })

    expect(suggestions).toEqual([])
  })

  it("counts factual reliability states and omits unsafe credential states", () => {
    const suggestions = buildReturningVolunteerSuggestions({
      organizerTeamId: "team_organizer",
      currentCompetitionId: "comp_current",
      roster: [
        {
          id: "membership:tmem_1",
          name: "Katherine Johnson",
          status: "active",
          availability: "all_day",
          roleTypes: ["staff"],
        },
      ],
      identities: [
        {
          id: "cvid_katherine",
          teamId: "team_organizer",
          rosterVolunteerId: "membership:tmem_1",
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
        competitionId: index < 4 ? "comp_a" : "comp_b",
        competitionName: index < 4 ? "Spring Classic" : "Fall Classic",
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
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
        {
          identityId: "cvid_katherine",
          teamId: "team_organizer",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.SAFETY,
          credentialLabel: "Expired safety",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.EXPIRED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
        {
          identityId: "cvid_katherine",
          teamId: "team_organizer",
          credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.EQUIPMENT,
          credentialLabel: "Revoked rigging",
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.REVOKED,
          visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
        },
      ],
    })

    expect(suggestions[0]?.priorEventCount).toBe(2)
    expect(suggestions[0]?.reliability).toEqual({
      signedUp: 1,
      imported: 1,
      assigned: 1,
      confirmed: 1,
      declined: 1,
      changeRequested: 1,
      noShow: 1,
      completed: 1,
    })
    expect(suggestions[0]?.credentials).toEqual([
      {
        credentialType: "medical",
        credentialLabel: "EMT",
        status: "verified",
      },
    ])
  })
})
