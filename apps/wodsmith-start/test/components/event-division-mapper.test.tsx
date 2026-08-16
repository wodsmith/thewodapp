// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: unknown) => serverFn,
}))

vi.mock("@/server-fns/event-division-mapping-fns", () => ({
  saveEventDivisionMappingsFn: vi.fn(),
}))

import { EventDivisionMapper } from "@/components/event-division-mapper"

type MappingData = ComponentProps<typeof EventDivisionMapper>["data"]

const baseData: MappingData = {
  events: [],
  divisions: [],
  mappings: [],
  hasMappings: false,
}

describe("organizer event division prerequisites", () => {
  // @lat: [[ui-library#UI Library#Current boundary#Empty state composition#Direct organizer consumers#Start event mapping event prerequisite]]
  it("names the missing-events prerequisite as a section heading", () => {
    render(
      <EventDivisionMapper competitionId="competition_1" data={baseData} />,
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "No events yet" }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Add competition events first, then configure which divisions can see each event.",
      ),
    ).toBeVisible()
  })

  // @lat: [[ui-library#UI Library#Current boundary#Empty state composition#Direct organizer consumers#Start event mapping division prerequisite]]
  it("names the missing-divisions prerequisite as a section heading", () => {
    render(
      <EventDivisionMapper
        competitionId="competition_1"
        data={{
          ...baseData,
          events: [
            {
              trackWorkoutId: "track_workout_1",
              eventName: "Event 1",
              trackOrder: 1,
              parentEventId: null,
            },
          ],
        }}
      />,
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "No divisions yet" }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Set up competition divisions first, then map events to the divisions that should see them.",
      ),
    ).toBeVisible()
  })
})
