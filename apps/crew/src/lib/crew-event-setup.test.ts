import { describe, expect, it } from "vitest"
import {
  adminOnlyCrewSetupFieldKeys,
  crewSetupChecklistItems,
  mergeOrganizerCrewSetupState,
  organizerCrewSetupFieldKeys,
  parseCrewSettings,
  serializeCrewSettings,
  toOrganizerCrewSetupState,
} from "./crew-event-setup"

describe("Crew event setup", () => {
  it("splits organizer setup fields from admin-only setup fields", () => {
    expect(organizerCrewSetupFieldKeys).toEqual([
      "volunteerTarget",
      "staffingLead",
      "assumptions",
    ])
    expect(adminOnlyCrewSetupFieldKeys).toEqual([
      "desiredGoLiveDate",
      "sourceContactName",
      "sourceContactEmail",
      "internalNotes",
    ])
  })

  it("keeps organizer checklist labels client-safe", () => {
    const labels = crewSetupChecklistItems.map((item) => item.label).join(" ")

    expect(labels).not.toMatch(
      /concierge|operator|billing|conversion|internal|handoff|source access/i,
    )
  })

  it("preserves admin-only setup values when organizer fields are saved", () => {
    const originalSettings = JSON.stringify({
      arbitrary: { keep: true },
      setup: {
        desiredGoLiveDate: "2026-08-01",
        sourceContactName: "Taylor",
        sourceContactEmail: "taylor@example.com",
        volunteerTarget: "24",
        staffingLead: "Sam",
        checklist: {
          eventBasicsConfirmed: true,
          sourceAccessConfirmed: false,
          volunteerNeedsDrafted: false,
          staffingPlanDrafted: false,
          operatorHandoffReady: false,
        },
        internalNotes: "Private operator note.",
        assumptions: "One judge per lane.",
      },
    })
    const parsed = parseCrewSettings(originalSettings)
    const organizerSetup = toOrganizerCrewSetupState(parsed.setup)

    const serialized = serializeCrewSettings(
      originalSettings,
      mergeOrganizerCrewSetupState(parsed.setup, {
        ...organizerSetup,
        volunteerTarget: "32",
        assumptions: "Two judges per lane.",
        checklist: {
          ...organizerSetup.checklist,
          volunteerNeedsDrafted: true,
        },
      }),
    )
    const next = JSON.parse(serialized)

    expect(next.arbitrary.keep).toBe(true)
    expect(next.setup).toMatchObject({
      desiredGoLiveDate: "2026-08-01",
      sourceContactName: "Taylor",
      sourceContactEmail: "taylor@example.com",
      internalNotes: "Private operator note.",
      volunteerTarget: "32",
      assumptions: "Two judges per lane.",
      checklist: {
        eventBasicsConfirmed: true,
        volunteerNeedsDrafted: true,
      },
    })
  })
})
