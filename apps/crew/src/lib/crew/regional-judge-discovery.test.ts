// @lat: [[crew#Regional Judge Discovery Pilot]]
import { describe, expect, it } from "vitest"
import {
  CREW_VOLUNTEER_CONSENT_SCOPE,
  CREW_VOLUNTEER_CONSENT_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_STATUS,
  CREW_VOLUNTEER_CREDENTIAL_TYPE,
  CREW_VOLUNTEER_DISCOVERY_AGE_STATUS,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  CREW_VOLUNTEER_IDENTITY_STATUS,
  CREW_VOLUNTEER_INTRO_REQUEST_STATUS,
} from "../../db/schemas/crew-volunteer-intelligence"
import {
  buildCrewRegionalJudgeDiscoveryViewModel,
  buildCrewRegionalJudgeIntroRequestView,
  resolveCrewRegionalJudgeDiscoveryGate,
  resolveCrewRegionalJudgeIntroRequestedRole,
  type CrewRegionalJudgeDiscoveryConsentRecord,
  type CrewRegionalJudgeDiscoveryCredentialRecord,
  type CrewRegionalJudgeDiscoveryHistoryRecord,
  type CrewRegionalJudgeDiscoveryIdentityRecord,
} from "./regional-judge-discovery"

const enabledGate = resolveCrewRegionalJudgeDiscoveryGate("enabled")

describe("regional judge discovery", () => {
  it("stays inert when the feature gate is not explicitly enabled", () => {
    const gate = resolveCrewRegionalJudgeDiscoveryGate(undefined)
    const view = buildCrewRegionalJudgeDiscoveryViewModel({
      gate,
      requestingTeamId: "team_requester",
      currentCompetitionId: "comp_current",
      identities: [adultIdentity("cvid_ada")],
      consents: [regionalConsent("cvc_ada", "cvid_ada")],
      historyEvents: [judgeHistory("cvid_ada")],
      credentials: [],
    })

    expect(gate.enabled).toBe(false)
    expect(view.candidates).toEqual([])
    expect(view.summary).toEqual({
      candidateCount: 0,
      pendingIntroRequestCount: 0,
      safeCredentialCount: 0,
    })
    expect(view.notices.join(" ")).toContain(
      "CREW_REGIONAL_JUDGE_DISCOVERY_ENABLED",
    )
  })

  it("requires current regional consent, adult eligibility, active identity, and cross-organizer scope", () => {
    const view = buildCrewRegionalJudgeDiscoveryViewModel({
      gate: enabledGate,
      requestingTeamId: "team_requester",
      currentCompetitionId: "comp_current",
      identities: [
        adultIdentity("cvid_eligible"),
        adultIdentity("cvid_same_team", { teamId: "team_requester" }),
        adultIdentity("cvid_import", {
          identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.IMPORT,
        }),
        adultIdentity("cvid_minor", {
          discoveryAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.MINOR_BLOCKED,
        }),
        adultIdentity("cvid_archived", {
          status: CREW_VOLUNTEER_IDENTITY_STATUS.ARCHIVED,
        }),
        adultIdentity("cvid_revoked"),
        adultIdentity("cvid_superseded"),
      ],
      consents: [
        regionalConsent("cvc_eligible", "cvid_eligible"),
        regionalConsent("cvc_same_team", "cvid_same_team", {
          teamId: "team_requester",
        }),
        regionalConsent("cvc_import", "cvid_import"),
        regionalConsent("cvc_minor", "cvid_minor"),
        regionalConsent("cvc_archived", "cvid_archived"),
        regionalConsent("cvc_revoked", "cvid_revoked", {
          status: CREW_VOLUNTEER_CONSENT_STATUS.REVOKED,
          revokedAt: "2026-06-20T12:00:00.000Z",
        }),
        regionalConsent("cvc_superseded", "cvid_superseded", {
          supersededByConsentId: "cvc_later_revoke",
        }),
      ],
      historyEvents: [
        judgeHistory("cvid_eligible"),
        judgeHistory("cvid_same_team"),
        judgeHistory("cvid_import"),
        judgeHistory("cvid_minor"),
        judgeHistory("cvid_archived"),
        judgeHistory("cvid_revoked"),
        judgeHistory("cvid_superseded"),
      ],
      credentials: [],
    })

    expect(view.candidates.map((candidate) => candidate.candidateId)).toEqual([
      "cvid_eligible",
    ])
  })

  it("excludes import-only history while preserving safe regional judge aggregates", () => {
    const view = buildCrewRegionalJudgeDiscoveryViewModel({
      gate: enabledGate,
      requestingTeamId: "team_requester",
      currentCompetitionId: "comp_current",
      identities: [
        adultIdentity("cvid_import_only"),
        adultIdentity("cvid_ada"),
      ],
      consents: [
        regionalConsent("cvc_import_only", "cvid_import_only"),
        regionalConsent("cvc_ada", "cvid_ada"),
      ],
      historyEvents: [
        judgeHistory("cvid_import_only", {
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.IMPORTED,
        }),
        judgeHistory("cvid_ada", {
          competitionId: "comp_prior_a",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.ASSIGNED,
          occurredAt: "2026-05-01T12:00:00.000Z",
        }),
        judgeHistory("cvid_ada", {
          competitionId: "comp_prior_a",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
          occurredAt: "2026-05-02T12:00:00.000Z",
        }),
        judgeHistory("cvid_ada", {
          competitionId: "comp_prior_b",
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.COMPLETED,
          occurredAt: "2026-05-03T12:00:00.000Z",
        }),
        judgeHistory("cvid_ada", {
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW,
          occurredAt: "2026-05-04T12:00:00.000Z",
        }),
      ],
      credentials: [
        judgeCredential("cvid_ada", "L1 Judge"),
        judgeCredential("cvid_ada", "Revoked Judge", {
          status: CREW_VOLUNTEER_CREDENTIAL_STATUS.REVOKED,
          revokedAt: "2026-05-01T12:00:00.000Z",
        }),
      ],
    })

    expect(view.candidates).toHaveLength(1)
    expect(view.candidates[0]).toMatchObject({
      candidateId: "cvid_ada",
      regionLabel: "ID, US",
      availabilitySummary: "Not shared in this pilot",
      roleTypes: ["judge"],
      factualHistory: {
        priorEventCount: 2,
        assignedCount: 1,
        confirmedCount: 1,
        completedCount: 1,
        lastActivityAt: "2026-05-03T12:00:00.000Z",
      },
      credentialSummary: [
        {
          credentialType: "judge_course",
          credentialLabel: "L1 Judge",
          status: "verified",
        },
      ],
    })
    expect(JSON.stringify(view)).not.toContain("import_only")
    expect(JSON.stringify(view)).not.toContain("NO_SHOW")
    expect(JSON.stringify(view)).not.toContain("Revoked Judge")
  })

  it("serializes only privacy-safe candidate facts", () => {
    const view = buildCrewRegionalJudgeDiscoveryViewModel({
      gate: enabledGate,
      requestingTeamId: "team_requester",
      currentCompetitionId: "comp_current",
      identities: [adultIdentity("cvid_privacy")],
      consents: [regionalConsent("cvc_privacy", "cvid_privacy")],
      historyEvents: [judgeHistory("cvid_privacy")],
      credentials: [judgeCredential("cvid_privacy", "L1 Judge")],
      introRequests: [
        {
          id: "cvir_pending",
          volunteerIdentityId: "cvid_privacy",
          status: CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
          requestedAt: "2026-06-21T12:00:00.000Z",
        },
      ],
    })

    expect(view.candidates[0]?.displayLabel).toBe("Opted-in judge 1")
    expect(view.candidates[0]?.introRequest).toEqual({
      id: "cvir_pending",
      status: "pending",
      requestedAt: "2026-06-21T12:00:00.000Z",
      directContactShared: false,
    })

    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain("ada@example.com")
    expect(serialized).not.toContain("555-1234")
    expect(serialized).not.toContain("emergencyContact")
    expect(serialized).not.toContain("internalNotes")
    expect(serialized).not.toContain("stripe")
    expect(serialized).not.toContain("rating")
    expect(serialized).not.toContain("ranking")
    expect(serialized).not.toContain("top judge")
  })

  it("keeps intro requests blind until a later acceptance flow exists", () => {
    expect(
      buildCrewRegionalJudgeIntroRequestView({
        requestId: "cvir_123",
        status: CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING,
        outcome: "created",
      }),
    ).toEqual({
      requestId: "cvir_123",
      status: "pending",
      outcome: "created",
      directContactShared: false,
      contactReveal: "deferred_until_volunteer_accepts",
    })
  })

  it("normalizes intro requested roles to the candidate's eligible regional roles", () => {
    expect(
      resolveCrewRegionalJudgeIntroRequestedRole({
        requestedRoleType: null,
        eligibleRoleTypes: ["head_judge", "judge"],
      }),
    ).toBe("head_judge")
    expect(
      resolveCrewRegionalJudgeIntroRequestedRole({
        requestedRoleType: "head_judge",
        eligibleRoleTypes: ["head_judge", "judge"],
      }),
    ).toBe("head_judge")
    expect(
      resolveCrewRegionalJudgeIntroRequestedRole({
        requestedRoleType: "head_judge",
        eligibleRoleTypes: ["judge"],
      }),
    ).toBeNull()
  })
})

function adultIdentity(
  id: string,
  overrides: Partial<CrewRegionalJudgeDiscoveryIdentityRecord> = {},
): CrewRegionalJudgeDiscoveryIdentityRecord {
  return {
    id,
    teamId: "team_source",
    identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
    discoveryAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED,
    status: CREW_VOLUNTEER_IDENTITY_STATUS.ACTIVE,
    ...overrides,
  }
}

function regionalConsent(
  id: string,
  identityId: string,
  overrides: Partial<CrewRegionalJudgeDiscoveryConsentRecord> = {},
): CrewRegionalJudgeDiscoveryConsentRecord {
  return {
    id,
    identityId,
    teamId: "team_source",
    scope: CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
    status: CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
    grantedAt: "2026-06-01T12:00:00.000Z",
    revokedAt: null,
    supersededByConsentId: null,
    ...overrides,
  }
}

function judgeHistory(
  identityId: string,
  overrides: Partial<CrewRegionalJudgeDiscoveryHistoryRecord> = {},
): CrewRegionalJudgeDiscoveryHistoryRecord {
  return {
    identityId,
    teamId: "team_source",
    competitionId: "comp_prior",
    competitionName: "Boise Throwdown",
    eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
    visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.CONSENTED_INTRO,
    roleType: "judge",
    occurredAt: "2026-05-01T12:00:00.000Z",
    regionLabel: "ID, US",
    ...overrides,
  }
}

function judgeCredential(
  identityId: string,
  label: string,
  overrides: Partial<CrewRegionalJudgeDiscoveryCredentialRecord> = {},
): CrewRegionalJudgeDiscoveryCredentialRecord {
  return {
    identityId,
    teamId: "team_source",
    credentialType: CREW_VOLUNTEER_CREDENTIAL_TYPE.JUDGE_COURSE,
    credentialLabel: label,
    status: CREW_VOLUNTEER_CREDENTIAL_STATUS.VERIFIED,
    visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.CONSENTED_INTRO,
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  }
}
