// @lat: [[crew#Import CSV Preview#Parser Warnings]]
import { strToU8, zipSync } from "fflate"
import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv"
import { parseCrewImportFile } from "./file"
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
    expect(parsed.fileIssues[0]?.message).toContain(
      "Email (column 2) / email (column 3)",
    )
  })

  it("rejects legacy Excel files instead of treating them as CSV", () => {
    const parsed = parseCrewImportFile({
      filename: "volunteers.xls",
      mimeType: "application/vnd.ms-excel",
      data: new Uint8Array([1, 2, 3]),
    })

    expect(parsed.fileIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_file_type" }),
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

  it("rejects sign-adjacent heat numbers", () => {
    for (const heatLabel of ["-3", "+3", "3-", "3+"]) {
      const preview = buildCrewImportPreview({
        kind: "heat_schedule",
        context: previewContext,
        csvText: `Workout,Heat,Start Time\nEvent 1,${heatLabel},9:00 AM`,
      })

      expect(preview.rows[0]?.action).toBe("error")
      expect(preview.rows[0]?.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "invalid_heat_number" }),
        ]),
      )
    }
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

  it("previews volunteer rows from an Excel workbook", () => {
    const workbook = createXlsxWorkbook([
      ["Full Name", "Email", "Role", "Division"],
      ["Ian Jones", "IAN@example.com", "Lane judges", "RX"],
    ])

    const preview = buildCrewImportPreview({
      kind: "volunteers",
      context: previewContext,
      file: {
        filename: "volunteers.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data: workbook,
      },
    })

    expect(preview.headers).toEqual(["Full Name", "Email", "Role", "Division"])
    expect(preview.rows[0]?.normalizedRow).toMatchObject({
      name: "Ian Jones",
      email: "ian@example.com",
      role: "Lane judges",
      division: "RX",
    })
    expect(preview.errorCount).toBe(0)
  })

  it("formats Excel time cells before heat schedule preview", () => {
    const workbook = createXlsxWorkbook(
      [
        ["Workout", "Heat", "Start Time"],
        ["Event 1", "Heat 1", { value: 0.375, style: 1 }],
      ],
      {
        stylesXml: [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
          '<cellXfs count="2">',
          '<xf numFmtId="0" applyNumberFormat="0"/>',
          '<xf numFmtId="20" applyNumberFormat="1"/>',
          "</cellXfs>",
          "</styleSheet>",
        ].join(""),
      },
    )

    const parsed = parseCrewImportFile(
      {
        filename: "heat-schedule.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data: workbook,
      },
      { maxRows: 20 },
    )
    const preview = buildCrewImportPreview({
      kind: "heat_schedule",
      context: previewContext,
      file: {
        filename: "heat-schedule.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data: workbook,
      },
    })

    expect(parsed.rows[0]?.values["Start Time"]).toBe("9:00 AM")
    expect(preview.rows[0]?.normalizedRow).toMatchObject({
      workout: "Event 1",
      heatNumber: 1,
      scheduledTime: "9:00 AM",
    })
    expect(preview.errorCount).toBe(0)
  })
})

type XlsxCell = string | number | { value: string | number; style?: number }

function createXlsxWorkbook(
  rows: XlsxCell[][],
  options: { stylesXml?: string } = {},
) {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        "</Types>",
      ].join(""),
    ),
    "_rels/.rels": strToU8(
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
        "</Relationships>",
      ].join(""),
    ),
    "xl/workbook.xml": strToU8(
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        "<sheets>",
        '<sheet name="Sheet1" sheetId="1" r:id="rId1"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        "</Relationships>",
      ].join(""),
    ),
    "xl/worksheets/sheet1.xml": strToU8(createWorksheetXml(rows)),
    "xl/styles.xml": strToU8(
      options.stylesXml ??
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
          '<cellXfs count="1"><xf numFmtId="0" applyNumberFormat="0"/></cellXfs>',
          "</styleSheet>",
        ].join(""),
    ),
  }

  return zipSync(files)
}

function createWorksheetXml(rows: XlsxCell[][]) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
    rows
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">${row
            .map((cell, columnIndex) =>
              createCellXml(cell, rowIndex + 1, columnIndex),
            )
            .join("")}</row>`,
      )
      .join(""),
    "</sheetData>",
    "</worksheet>",
  ].join("")
}

function createCellXml(cell: XlsxCell, rowNumber: number, columnIndex: number) {
  const normalizedCell =
    typeof cell === "object" && cell !== null ? cell : { value: cell }
  const ref = `${columnName(columnIndex)}${rowNumber}`
  const style = normalizedCell.style ? ` s="${normalizedCell.style}"` : ""

  if (typeof normalizedCell.value === "number") {
    return `<c r="${ref}"${style}><v>${normalizedCell.value}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(normalizedCell.value)}</t></is></c>`
}

function columnName(columnIndex: number) {
  let column = columnIndex + 1
  let name = ""

  while (column > 0) {
    const remainder = (column - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    column = Math.floor((column - 1) / 26)
  }

  return name
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
