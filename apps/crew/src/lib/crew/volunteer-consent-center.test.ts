import { describe, expect, it } from "vitest"
import {
  CREW_VOLUNTEER_CONSENT_SCOPE,
  CREW_VOLUNTEER_CONSENT_SOURCE,
  CREW_VOLUNTEER_CONSENT_STATUS,
  CREW_VOLUNTEER_DISCOVERY_AGE_STATUS,
} from "../../db/schemas/crew-volunteer-intelligence"
import {
  buildCrewVolunteerConsentCenterView,
  getCrewVolunteerConsentText,
  hashCrewVolunteerConsentText,
  resolveCrewVolunteerConsentMutation,
} from "./volunteer-consent-center"

describe("Crew volunteer consent center view model", () => {
  it("summarizes consent state without leaking raw contact or private metadata", () => {
    const view = buildCrewVolunteerConsentCenterView({
      eventName: "Boise Throwdown",
      volunteerLabel: "Your crew profile",
      identityAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED,
      consentRecords: [
        {
          id: "cvcon_communication",
          scope: CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
          status: CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
          consentTextVersion: "2026-06-21.v1",
          source: CREW_VOLUNTEER_CONSENT_SOURCE.CONSENT_CENTER,
          sourceSurface: "public_consent_center",
          grantedAt: "2026-06-21T12:00:00.000Z",
          revokedAt: null,
          supersededByConsentId: null,
        },
      ],
    })

    expect(view.scopes).toEqual([
      expect.objectContaining({
        scope: CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
        granted: true,
        canRevoke: true,
        statusLabel: "Granted",
      }),
      expect.objectContaining({
        scope: CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
        granted: false,
        canGrant: true,
        statusLabel: "Not granted",
      }),
    ])
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain("ada@example.com")
    expect(serialized).not.toContain("555")
    expect(serialized).not.toContain("emergency")
    expect(serialized).not.toContain("internalNotes")
    expect(serialized).not.toContain("stripe")
  })

  it("keeps imported or unknown-age volunteers out of regional discovery by default", () => {
    const view = buildCrewVolunteerConsentCenterView({
      eventName: "Boise Throwdown",
      volunteerLabel: "Your crew profile",
      identityAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.UNKNOWN,
      consentRecords: [],
    })

    expect(
      view.scopes.find(
        (scope) =>
          scope.scope === CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
      ),
    ).toMatchObject({
      granted: false,
      canGrant: false,
      disabledReason:
        "Regional discovery requires adult eligibility before opt-in.",
    })
  })

  it("treats revocation as the current state while retaining audit metadata", () => {
    const view = buildCrewVolunteerConsentCenterView({
      eventName: "Boise Throwdown",
      volunteerLabel: "Your crew profile",
      identityAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.ADULT_CONFIRMED,
      consentRecords: [
        {
          id: "cvcon_old",
          scope: CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
          status: CREW_VOLUNTEER_CONSENT_STATUS.REVOKED,
          consentTextVersion: "2026-06-21.v1",
          source: CREW_VOLUNTEER_CONSENT_SOURCE.CONSENT_CENTER,
          sourceSurface: "public_consent_center",
          grantedAt: "2026-06-20T12:00:00.000Z",
          revokedAt: "2026-06-21T12:00:00.000Z",
          supersededByConsentId: "cvcon_revoke",
        },
        {
          id: "cvcon_revoke",
          scope: CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
          status: CREW_VOLUNTEER_CONSENT_STATUS.REVOKED,
          consentTextVersion: "2026-06-21.v1",
          source: CREW_VOLUNTEER_CONSENT_SOURCE.CONSENT_CENTER,
          sourceSurface: "public_consent_center",
          grantedAt: "2026-06-21T12:00:00.000Z",
          revokedAt: "2026-06-21T12:00:00.000Z",
          supersededByConsentId: null,
        },
      ],
    })

    expect(
      view.scopes.find(
        (scope) =>
          scope.scope === CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
      ),
    ).toMatchObject({
      currentConsentId: "cvcon_revoke",
      granted: false,
      canGrant: true,
      statusLabel: "Revoked",
      lastUpdatedAt: "2026-06-21T12:00:00.000Z",
    })
  })
})

describe("Crew volunteer consent mutation policy", () => {
  it("blocks regional discovery grants without adult eligibility", () => {
    expect(
      resolveCrewVolunteerConsentMutation({
        action: "grant",
        scope: CREW_VOLUNTEER_CONSENT_SCOPE.REGIONAL_DISCOVERY,
        identityAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.MINOR_BLOCKED,
        activeConsentId: null,
      }),
    ).toEqual({ ok: false, reason: "regional_age_blocked" })
  })

  it("makes repeated grant and revoke actions idempotent", () => {
    expect(
      resolveCrewVolunteerConsentMutation({
        action: "grant",
        scope: CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
        identityAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.UNKNOWN,
        activeConsentId: "cvcon_active",
      }),
    ).toEqual({ ok: true, outcome: "idempotent" })

    expect(
      resolveCrewVolunteerConsentMutation({
        action: "revoke",
        scope: CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
        identityAgeStatus: CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.UNKNOWN,
        activeConsentId: null,
      }),
    ).toEqual({ ok: true, outcome: "idempotent" })
  })

  it("hashes versioned consent text without raw contact fields", async () => {
    const text = getCrewVolunteerConsentText({
      scope: CREW_VOLUNTEER_CONSENT_SCOPE.COMMUNICATION_HISTORY,
      action: "grant",
    })
    const hash = await hashCrewVolunteerConsentText(text)

    expect(text).toContain("does not enable SMS messaging")
    expect(text).not.toContain("555")
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    await expect(hashCrewVolunteerConsentText(text)).resolves.toBe(hash)
  })
})
