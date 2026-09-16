import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
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

function createImportPreview(importId = "cimp_preview") {
  return {
    importId,
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
}

function previewResponse(importId?: string) {
  return {
    ok: true,
    json: async () => ({ importPreview: createImportPreview(importId) }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(previewResponse()))

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

  it("ignores a preview response when the draft changes in flight", async () => {
    let resolveLatePreview: (
      response: ReturnType<typeof previewResponse>,
    ) => void = () => {}
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(previewResponse("cimp_current"))
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof previewResponse>>((resolve) => {
            resolveLatePreview = resolve
          }),
      )
    vi.stubGlobal("fetch", fetchMock)

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
      fireEvent.click(screen.getByRole("button", { name: "Build preview" }))
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Source label (optional)"), {
        target: { value: "Updated while previewing" },
      })
    })

    await act(async () => {
      resolveLatePreview(previewResponse("cimp_outdated"))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(
      screen.getByRole("button", { name: "Import volunteers" }),
    ).toBeDisabled()
    expect(screen.getByText("Preview needs to be rebuilt")).toBeInTheDocument()
  })
})
