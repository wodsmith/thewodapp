// @lat: [[crew#Strategic Moat Privacy Model]]
import { describe, expect, it } from "vitest"
import {
  CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
} from "../db/schemas/crew-volunteer-intelligence"
import {
  assertCrewVolunteerIdentityHasAnchor,
  buildCrewVolunteerHistoryDedupeKey,
  buildCrewVolunteerHistoryEventInsert,
  buildCrewVolunteerIdentityAnchors,
  buildCrewVolunteerIdentityInsert,
  hashCrewVolunteerContactAnchor,
  normalizeCrewVolunteerHistoryEmail,
  normalizeCrewVolunteerHistoryPhone,
} from "./crew-volunteer-history.server"

describe("Crew volunteer history helpers", () => {
  it("normalizes and hashes contact anchors without storing raw contact values", async () => {
    expect(normalizeCrewVolunteerHistoryEmail("  PERSON@Example.COM ")).toBe(
      "person@example.com",
    )
    expect(normalizeCrewVolunteerHistoryPhone(" +1 (555) 123-4567 ")).toBe(
      "+15551234567",
    )

    const emailHash = await hashCrewVolunteerContactAnchor(
      "email",
      "Person@example.com",
    )
    const sameEmailHash = await hashCrewVolunteerContactAnchor(
      "email",
      " person@EXAMPLE.com ",
    )
    const phoneHash = await hashCrewVolunteerContactAnchor(
      "phone",
      "+1 (555) 123-4567",
    )

    expect(emailHash).toBe(sameEmailHash)
    expect(emailHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(phoneHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(emailHash).not.toContain("person@example.com")
    expect(phoneHash).not.toContain("555")
  })

  it("requires at least one identity anchor before creating an identity row", async () => {
    const anchors = await buildCrewVolunteerIdentityAnchors({
      email: " volunteer@example.com ",
    })
    expect(() => assertCrewVolunteerIdentityHasAnchor(anchors)).not.toThrow()

    const identity = buildCrewVolunteerIdentityInsert({
      teamId: "team_organizer",
      anchors,
      sourceCompetitionId: "comp_1",
      sourceMembershipId: null,
      sourceInvitationId: "tinv_1",
      identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
      now: new Date("2026-06-21T12:00:00.000Z"),
    })

    expect(identity).toMatchObject({
      teamId: "team_organizer",
      userId: null,
      phoneHash: null,
      contactHashVersion: "v1",
      sourceCompetitionId: "comp_1",
      sourceInvitationId: "tinv_1",
      identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
    })
    expect(identity.emailHash).toMatch(/^sha256:[0-9a-f]{64}$/)

    await expect(buildCrewVolunteerIdentityAnchors({})).resolves.toMatchObject({
      userId: null,
      emailHash: null,
      phoneHash: null,
    })
    expect(() =>
      buildCrewVolunteerIdentityInsert({
        teamId: "team_organizer",
        anchors: {
          userId: null,
          emailHash: null,
          phoneHash: null,
          contactHashVersion: "v1",
        },
        sourceCompetitionId: "comp_1",
        sourceMembershipId: null,
        sourceInvitationId: null,
        identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.MANUAL,
        now: new Date("2026-06-21T12:00:00.000Z"),
      }),
    ).toThrow(/requires a user, email hash, or phone hash anchor/)
  })

  it("scopes history to the organizer team and safe factual fields only", () => {
    const occurredAt = new Date("2026-06-21T12:00:00.000Z")
    const event = buildCrewVolunteerHistoryEventInsert({
      teamId: "team_organizer",
      competitionId: "comp_crew",
      groupId: "cgrp_series",
      identityId: "cvid_1",
      eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.IMPORTED,
      assignmentType: CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.VOLUNTEER_SHIFT,
      assignmentId: "vsa_1",
      roleType: "judge",
      occurredAt,
      sourceType: "crew_import_row",
      sourceId: "cimp_1:2",
      sourceUserId: "user_ops",
    })

    expect(event).toMatchObject({
      teamId: "team_organizer",
      competitionId: "comp_crew",
      groupId: "cgrp_series",
      visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
      eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.IMPORTED,
      sourceType: "crew_import_row",
      sourceId: "cimp_1:2",
      sourceUserId: "user_ops",
      roleType: "judge",
    })
    expect(JSON.stringify(event)).not.toContain("volunteer@example.com")
    expect(event).not.toHaveProperty("metadata")
    expect(event).not.toHaveProperty("email")
    expect(event).not.toHaveProperty("phone")
    expect(event).not.toHaveProperty("privateNote")
    expect(event).not.toHaveProperty("stripePaymentIntentId")
  })

  it("uses stable dedupe keys for replayed source actions", () => {
    const replay = {
      teamId: "team_organizer",
      competitionId: "comp_crew",
      identityId: "cvid_1",
      eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED,
      sourceType: "crew_assignment_confirmation",
      sourceId: "caconf_1",
      assignmentType: CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.VOLUNTEER_SHIFT,
      assignmentId: "vsa_1",
    }

    expect(buildCrewVolunteerHistoryDedupeKey(replay)).toBe(
      buildCrewVolunteerHistoryDedupeKey({ ...replay }),
    )
    expect(
      buildCrewVolunteerHistoryDedupeKey({
        ...replay,
        eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED,
      }),
    ).not.toBe(buildCrewVolunteerHistoryDedupeKey(replay))
    expect(
      buildCrewVolunteerHistoryDedupeKey({
        ...replay,
        teamId: "team_other",
      }),
    ).not.toBe(buildCrewVolunteerHistoryDedupeKey(replay))
  })
})
