import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VolunteerImportFlow } from "@/components/crew/volunteer-import-flow"

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: unknown) => serverFn,
}))

vi.mock("@/server-fns/crew-import-fns", () => ({
  applyCrewImportFn: async () => undefined,
  getCrewImportMappingSuggestionFn: () => new Promise(() => {}),
  getCrewVolunteerImportQuestionsFn: () => new Promise(() => {}),
  saveCrewImportMappingPresetFn: async () => ({ suggestion: null }),
}))

vi.mock("@/lib/crew/imports/file", () => ({
  CREW_IMPORT_ACCEPTED_FILE_TYPES: ".csv",
  parseCrewImportFile: () => ({ headers: ["Email"], fileIssues: [] }),
}))

describe("VolunteerImportFlow", () => {
  // @lat: [[crew#Import Apply#Dedicated Volunteer Import Screen]]
  it("keeps every import step and primary action visible before upload", () => {
    render(
      <VolunteerImportFlow
        eventId="comp_crew_demo"
        onApplyComplete={async () => {}}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: "1. Choose a file and match columns",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "2. Review the preview" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "3. Import ready volunteers" }),
    ).toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Build preview" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Import volunteers" }),
    ).toBeDisabled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("invalidates a preview when the import setup changes", async () => {
    const importPreview = {
      importId: "cimp_preview",
      kind: "volunteers",
      status: "previewed",
      originalFilename: "volunteers.csv",
      warningCount: 0,
      fileIssues: [],
      rows: [
        {
          rowNumber: 2,
          action: "create",
          errors: [],
          warnings: [],
          normalizedRow: { email: "sam@example.com" },
        },
      ],
      volunteerQuestionPlan: null,
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ importPreview }),
      }),
    )

    render(
      <VolunteerImportFlow
        eventId="comp_crew_demo"
        onApplyComplete={async () => {}}
      />,
    )

    const file = new File(["Email\nsam@example.com"], "volunteers.csv", {
      type: "text/csv",
    })
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new ArrayBuffer(0),
    })
    await act(async () => {
      fireEvent.change(screen.getByLabelText("CSV or Excel file"), {
        target: { files: [file] },
      })
    })
    await act(async () => {
      fireEvent.click(
        await screen.findByRole("button", { name: "Build preview" }),
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(
      await screen.findByRole("button", { name: "Import 1 volunteer" }),
    ).toBeEnabled()

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Source label (optional)"), {
        target: { value: "Updated source" },
      })
    })

    expect(
      screen.getByRole("button", { name: "Import volunteers" }),
    ).toBeDisabled()
    expect(screen.getByText("Preview needs to be rebuilt")).toBeInTheDocument()
  })
})
