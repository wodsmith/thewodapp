import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { VolunteerImportWizard } from "@/components/crew/volunteer-import-wizard"
import type { PersistedCrewImportPreview } from "@/server-fns/crew-import-fns"

const mocks = vi.hoisted(() => ({
  applyImport: vi.fn(),
  getMappingSuggestion: vi.fn(),
  invalidate: vi.fn(),
  navigate: vi.fn(),
  resetNavigation: vi.fn(),
  proceedNavigation: vi.fn(),
  saveMappingPreset: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  useBlocker: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#roster">{children}</a>,
  useBlocker: mocks.useBlocker,
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: unknown) => serverFn,
}))

vi.mock("@/server-fns/crew-import-fns", () => ({
  applyCrewImportFn: mocks.applyImport,
  getCrewImportMappingSuggestionFn: mocks.getMappingSuggestion,
  saveCrewImportMappingPresetFn: mocks.saveMappingPreset,
}))

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}))

const readyPreview: PersistedCrewImportPreview = {
  importId: "cimp_ready",
  kind: "volunteers",
  parserVersion: "crew-csv-preview-v1",
  status: "previewed",
  originalFilename: "volunteers.csv",
  sourcePlatform: null,
  createdAt: new Date("2026-07-09T12:00:00Z"),
  headers: ["Name", "Email"],
  columnMapping: { name: "Name", email: "Email" },
  rows: [
    {
      rowNumber: 2,
      rawRow: { Name: "Jane Doe", Email: "jane@example.com" },
      normalizedRow: {
        firstName: "",
        lastName: "",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "",
        role: "",
        division: "",
        availability: "",
        notes: "",
      },
      targetType: "team_invitation",
      action: "create",
      warnings: [],
      errors: [],
    },
  ],
  fileIssues: [],
  rowCount: 1,
  skippedRowCount: 0,
  warningCount: 0,
  errorCount: 0,
}

describe("VolunteerImportWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMappingSuggestion.mockResolvedValue({ suggestion: null })
    mocks.invalidate.mockResolvedValue(undefined)
    mocks.navigate.mockResolvedValue(undefined)
    mocks.useBlocker.mockReturnValue({
      status: "idle",
      current: undefined,
      next: undefined,
      action: undefined,
      proceed: undefined,
      reset: undefined,
    })
  })

  // @lat: [[crew#Manual Volunteer Intake#Volunteer Import Wizard#Wizard Interaction Regression Tests]]
  it("requires the email mapping and preserves an explicit unmap choice", async () => {
    render(<VolunteerImportWizard eventId="comp_crew_demo" />)
    await selectCsv()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    const emailMapping = screen.getByLabelText("Email *")
    expect(emailMapping).toHaveValue("Email")

    fireEvent.change(emailMapping, { target: { value: "" } })

    expect(screen.getByText("Map this required field to continue.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()

    fireEvent.change(emailMapping, { target: { value: "Email" } })
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
  })

  it("rejects non-CSV files before reading or advancing", async () => {
    render(<VolunteerImportWizard eventId="comp_crew_demo" />)

    const file = new File(["not csv"], "volunteers.txt", {
      type: "text/plain",
    })
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [file] },
    })

    expect(await screen.findByText("Choose a CSV file to continue.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("prevents applying a preview with no ready rows", async () => {
    const blockedPreview: PersistedCrewImportPreview = {
      ...readyPreview,
      importId: "cimp_blocked",
      errorCount: 1,
      rows: readyPreview.rows.map((row) => ({
        ...row,
        action: "error" as const,
        errors: [
          {
            code: "missing_required_field",
            severity: "error" as const,
            message: "Email is required.",
          },
        ],
      })),
    }

    await renderReview(blockedPreview)

    expect(
      screen.getByRole("button", { name: "Apply volunteer list" }),
    ).toBeDisabled()
  })

  it("does not report a committed import as failed when refresh navigation fails", async () => {
    mocks.applyImport.mockResolvedValue({
      importId: readyPreview.importId,
      kind: "volunteers",
      status: "applied",
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      warningCount: 0,
      summary: {},
    })
    mocks.invalidate.mockRejectedValue(new Error("refresh failed"))
    mocks.navigate.mockRejectedValue(new Error("navigation failed"))

    await renderReview(readyPreview)
    fireEvent.click(screen.getByRole("button", { name: "Apply volunteer list" }))
    fireEvent.click(
      screen.getAllByRole("button", { name: "Apply volunteer list" }).at(-1)!,
    )

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Volunteer list applied")
    })
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.toastWarning).toHaveBeenCalledWith(
      "Volunteers were imported. Return to the roster to see the changes.",
    )
  })

  it("enables navigation protection after a CSV is selected", async () => {
    render(<VolunteerImportWizard eventId="comp_crew_demo" />)
    expect(mocks.useBlocker).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableBeforeUnload: false, withResolver: true }),
    )

    await selectCsv()

    await waitFor(() => {
      expect(mocks.useBlocker).toHaveBeenLastCalledWith(
        expect.objectContaining({ enableBeforeUnload: true, withResolver: true }),
      )
    })
  })
})

async function selectCsv() {
  const contents = "Name,Email\nJane Doe,jane@example.com"
  const file = new File(
    [contents],
    "volunteers.csv",
    { type: "text/csv" },
  )
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(contents),
  })
  fireEvent.change(screen.getByLabelText("Choose file"), {
    target: { files: [file] },
  })
  await waitFor(() => {
    expect(screen.getByText(/2 columns detected/)).toBeVisible()
  })
}

async function renderReview(preview: PersistedCrewImportPreview) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ importPreview: preview }),
    }),
  )
  render(<VolunteerImportWizard eventId="comp_crew_demo" />)
  await selectCsv()
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await screen.findByText(/Preview ready:/)
}
