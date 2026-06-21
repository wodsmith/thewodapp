import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EventImportTabs } from "@/routes/events/$eventId/imports"

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
}))

vi.mock("@/server-fns/crew-import-fns", () => ({
  applyCrewImportFn: vi.fn(),
  getCrewImportMappingSuggestionFn: vi.fn(),
  getCrewImportsPageFn: vi.fn(),
  saveCrewImportMappingPresetFn: vi.fn(),
}))

const reference = {
  roleLabels: ["Judge", "Floor"],
  divisions: [{ id: "div_rx", label: "Rx" }],
  workouts: [{ id: "workout_1", label: "Workout 1", trackOrder: 1 }],
  heats: [],
}

describe("EventImportTabs", () => {
  // @lat: [[crew#Import Tabs Duplicate Panel Regression]]
  it("keeps a single tab panel mounted while navigating import tabs", () => {
    render(
      <EventImportTabs
        eventId="comp_crew_demo"
        history={[]}
        reference={reference}
        onApplyComplete={async () => {}}
        onHistoryRefresh={async () => {}}
      />,
    )

    expectUploadPanel("Volunteers CSV")

    fireEvent.click(screen.getByRole("button", { name: "Heat schedule" }))
    expectUploadPanel("Heat schedule CSV")

    fireEvent.click(screen.getByRole("button", { name: "Roles" }))
    expectNoUploadPanels()
    expect(screen.getByText("Role assumptions")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "History" }))
    expectNoUploadPanels()
    expect(screen.getByText("No import previews yet.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Volunteers" }))
    expectUploadPanel("Volunteers CSV")

    fireEvent.click(screen.getByRole("button", { name: "Heat schedule" }))
    expectUploadPanel("Heat schedule CSV")

    fireEvent.click(screen.getByRole("button", { name: "Volunteers" }))
    expectUploadPanel("Volunteers CSV")
  })
})

function expectUploadPanel(expectedTitle: "Volunteers CSV" | "Heat schedule CSV") {
  const otherTitle =
    expectedTitle === "Volunteers CSV" ? "Heat schedule CSV" : "Volunteers CSV"

  expect(screen.getAllByText(expectedTitle)).toHaveLength(1)
  expect(screen.queryByText(otherTitle)).not.toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: "Preview CSV" })).toHaveLength(
    1,
  )
}

function expectNoUploadPanels() {
  expect(screen.queryByText("Volunteers CSV")).not.toBeInTheDocument()
  expect(screen.queryByText("Heat schedule CSV")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Preview CSV" }),
  ).not.toBeInTheDocument()
}
