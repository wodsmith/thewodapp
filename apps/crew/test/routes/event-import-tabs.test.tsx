import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EventImportTabs } from "@/components/crew/crew-import-tabs"

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
  it("keeps a single organizer upload panel mounted while choosing import type", () => {
    render(
      <EventImportTabs
        eventId="comp_crew_demo"
        history={[]}
        initialTab="volunteers"
        reference={reference}
        onApplyComplete={async () => {}}
        onHistoryRefresh={async () => {}}
      />,
    )

    expectUploadPanel("Volunteer list file")
    expect(screen.queryByText("Role assumptions")).not.toBeInTheDocument()
    expect(screen.queryByText("No uploads yet.")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Upload heat schedule/ }))
    expectUploadPanel("Heat schedule file")

    fireEvent.click(screen.getByRole("button", { name: /Upload heat schedule/ }))
    expectUploadPanel("Heat schedule file")

    fireEvent.click(screen.getByRole("button", { name: /Upload volunteer list/ }))
    expectUploadPanel("Volunteer list file")
  })

  it("keeps reference and upload history behind advanced details", () => {
    render(
      <EventImportTabs
        eventId="comp_crew_demo"
        history={[]}
        initialTab="volunteers"
        reference={reference}
        onApplyComplete={async () => {}}
        onHistoryRefresh={async () => {}}
      />,
    )

    expect(screen.queryByText("Role assumptions")).not.toBeInTheDocument()
    expect(screen.queryByText("No uploads yet.")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Advanced details"))

    expect(screen.getByText("Role assumptions")).toBeInTheDocument()
    expect(screen.getByText("No uploads yet.")).toBeInTheDocument()
  })

  it("opens the heat schedule panel when the route search selects it", () => {
    render(
      <EventImportTabs
        eventId="comp_crew_demo"
        history={[]}
        initialTab="heat_schedule"
        reference={reference}
        onApplyComplete={async () => {}}
        onHistoryRefresh={async () => {}}
      />,
    )

    expectUploadPanel("Heat schedule file")
  })
})

function expectUploadPanel(
  expectedTitle: "Volunteer list file" | "Heat schedule file",
) {
  const otherTitle =
    expectedTitle === "Volunteer list file"
      ? "Heat schedule file"
      : "Volunteer list file"

  expect(screen.getAllByText(expectedTitle)).toHaveLength(1)
  expect(screen.queryByText(otherTitle)).not.toBeInTheDocument()
  expect(
    screen.getAllByRole("button", {
      name:
        expectedTitle === "Volunteer list file"
          ? "Preview volunteer list"
          : "Preview heat schedule",
    }),
  ).toHaveLength(1)
}
