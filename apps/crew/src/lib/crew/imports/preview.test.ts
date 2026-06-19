// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv"
import { buildCrewImportPreview } from "./preview"
import type { CrewImportPreviewContext } from "./types"

const previewContext: CrewImportPreviewContext = {
  roleLabels: ["Lane judges", "Check-in"],
  divisions: [
    { id: "div_rx", label: "RX" },
    { id: "div_scaled", label: "Scaled" },
  ],
  workouts: [
    { id: "tw_1", label: "Event 1", trackOrder: 1 },
    { id: "tw_2", label: "Final", trackOrder: 2 },
  ],
  heats: [
    { trackWorkoutId: "tw_1", heatNumber: 1, divisionId: "div_rx" },
    { trackWorkoutId: "tw_1", heatNumber: 2, divisionId: "div_scaled" },
  ],
}

describe("parseCsv", () => {
  it("parses quoted commas and escaped quotes", () => {
    const parsed = parseCsv(
      'Name,Email,Notes\n"Jones, Ian",ian@example.com,"Said ""yes"""',
    )

    expect(parsed.headers).toEqual(["Name", "Email", "Notes"])
    expect(parsed.rows[0]?.values).toMatchObject({
      Name: "Jones, Ian",
      Email: "ian@example.com",
      Notes: 'Said "yes"',
    })
  })

  it("marks malformed rows without dropping row data", () => {
    const parsed = parseCsv("Name,Email\nIan,ian@example.com,extra")

    expect(parsed.rows[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "malformed_row", severity: "error" }),
      ]),
    )
    expect(parsed.rows[0]?.values.__extra_1).toBe("extra")
  })

  it("rejects duplicate non-empty headers before row mapping", () => {
    const parsed = parseCsv("Name,Email,email\nIan,first@example.com,second")

    expect(parsed.rows).toHaveLength(0)
    expect(parsed.fileIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_headers",
          severity: "error",
        }),
      ]),
    )
  })
})

describe("buildCrewImportPreview", () => {
  it("flags duplicate volunteer emails and unknown reference values", () => {
    const preview = buildCrewImportPreview({
      kind: "volunteers",
      context: previewContext,
      csvText: [
        "Full Name,Email,Role,Division",
        "Ian Jones,IAN@example.com,Lane judges,RX",
        "I J,ian@example.com,Unknown role,Masters",
      ].join("\n"),
    })

    expect(preview.warningCount).toBeGreaterThanOrEqual(3)
    expect(preview.rows[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_email" }),
      ]),
    )
    expect(preview.rows[1]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_email" }),
        expect.objectContaining({ code: "unknown_role" }),
        expect.objectContaining({ code: "unknown_division" }),
      ]),
    )
    expect(preview.rows[1]?.action).toBe("skip")
  })

  it("flags missing volunteer required fields", () => {
    const preview = buildCrewImportPreview({
      kind: "volunteers",
      context: previewContext,
      csvText: "Name,Role\n,Lane judges",
    })

    expect(preview.errorCount).toBeGreaterThanOrEqual(2)
    expect(preview.fileIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_required_mapping" }),
      ]),
    )
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_required_field" }),
      ]),
    )
  })

  it("previews heat schedule rows with unknown workout, division, and heat warnings", () => {
    const preview = buildCrewImportPreview({
      kind: "heat_schedule",
      context: previewContext,
      csvText: [
        "Workout,Heat,Division,Start Time",
        "Event 1,Heat 9,RX,9:00 AM",
        "Unknown,Heat 1,Masters,9:12 AM",
      ].join("\n"),
    })

    expect(preview.rows[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_heat" }),
      ]),
    )
    expect(preview.rows[1]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_workout" }),
        expect.objectContaining({ code: "unknown_division" }),
      ]),
    )
    expect(preview.errorCount).toBe(0)
  })

  it("rejects signed negative heat numbers", () => {
    const preview = buildCrewImportPreview({
      kind: "heat_schedule",
      context: previewContext,
      csvText: "Workout,Heat,Start Time\nEvent 1,-3,9:00 AM",
    })

    expect(preview.rows[0]?.action).toBe("error")
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_heat_number" }),
      ]),
    )
  })

  it("flags unknown heat when a known workout has no loaded heats", () => {
    const preview = buildCrewImportPreview({
      kind: "heat_schedule",
      context: { ...previewContext, heats: [] },
      csvText: "Workout,Heat,Start Time\nEvent 1,Heat 1,9:00 AM",
    })

    expect(preview.rows[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_heat" }),
      ]),
    )
  })
})
