import { describe, expect, it } from "vitest"
import {
  getCrewImportFileIssue,
  isCrewImportCsvUpload,
  MAX_CREW_IMPORT_BYTES,
} from "./file-validation"

describe("Crew import file validation", () => {
  it("accepts CSV filenames and supported CSV MIME types", () => {
    expect(isCrewImportCsvUpload("volunteers.csv", null)).toBe(true)
    expect(isCrewImportCsvUpload("volunteers", "text/csv; charset=utf-8")).toBe(
      true,
    )
    expect(
      isCrewImportCsvUpload("volunteers", "application/vnd.ms-excel"),
    ).toBe(true)
  })

  it("rejects unsupported files and oversized CSVs", () => {
    expect(
      getCrewImportFileIssue({
        name: "volunteers.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 100,
      }),
    ).toMatchObject({ code: "invalid_file_type" })
    expect(
      getCrewImportFileIssue({
        name: "volunteers.csv",
        type: "text/csv",
        size: MAX_CREW_IMPORT_BYTES + 1,
      }),
    ).toMatchObject({ code: "payload_too_large" })
  })
})
