import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerEventManager } from "@/components/events/organizer-event-manager"
import { DarkModeToggle } from "@/components/nav/dark-mode-toggle"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock("@/components/events/competition-event-row", () => ({
  CompetitionEventRow: ({ event }: { event: CompetitionWorkout }) => (
    <div data-event-row={event.id}>{event.workout.name}</div>
  ),
}))

vi.mock("@/components/events/add-event-dialog", () => ({
  AddEventDialog: () => null,
}))

vi.mock("@/components/events/create-event-dialog", () => ({
  CreateEventDialog: () => null,
}))

vi.mock("@/components/events/group-events-dialog", () => ({
  GroupEventsDialog: () => null,
}))

vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))

vi.mock("@/server-fns/competition-workouts-fns", () => ({
  createWorkoutAndAddToCompetitionFn: vi.fn(),
  groupCompetitionEventsFn: vi.fn(),
  removeWorkoutFromCompetitionFn: vi.fn(),
  reorderCompetitionEventsFn: vi.fn(),
}))

const createEvent = (index: number): CompetitionWorkout => ({
  id: `event-${index}`,
  trackId: "track-1",
  workoutId: `workout-${index}`,
  trackOrder: index,
  parentEventId: null,
  notes: null,
  pointsMultiplier: null,
  heatStatus: "draft",
  eventStatus: "draft",
  sponsorId: null,
  createdAt: new Date("2026-08-31T00:00:00.000Z"),
  updatedAt: new Date("2026-08-31T00:00:00.000Z"),
  workout: {
    id: `workout-${index}`,
    name: `Event ${index}`,
    description: null,
    scheme: "time",
    scoreType: null,
    roundsToScore: null,
    repsPerRound: null,
    tiebreakScheme: null,
    timeCap: null,
  },
})

const eventManager = (
  <OrganizerEventManager
    competitionId="competition-1"
    organizingTeamId="team-1"
    events={[createEvent(1), createEvent(2), createEvent(3)]}
    movements={[]}
    divisions={[]}
    divisionDescriptionsByWorkout={{}}
    sponsors={[]}
  />
)

function childTags(element: Element) {
  return Array.from(element.children, (child) => child.tagName)
}

function eventRowTags(container: Element) {
  return Array.from(
    container.querySelectorAll('input[aria-label^="Select Event"]'),
    (checkbox) => childTags(checkbox.parentElement?.parentElement as Element),
  )
}

describe("SSR hydration stability", () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  // @lat: [[organizer-dashboard#Event Management#Grouping Existing Events Under a Parent#Grouping Checkbox Hydration]]
  it("keeps organizer grouping checkbox rows identical outside forms", async () => {
    const serverMarkup = renderToString(eventManager)
    const serverContainer = document.createElement("div")
    serverContainer.innerHTML = serverMarkup
    const serverRows = eventRowTags(serverContainer)

    const clientContainer = document.createElement("div")
    clientContainer.innerHTML = serverMarkup
    document.body.appendChild(clientContainer)
    const recoverableErrors: Error[] = []
    let clientRoot: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      clientRoot = hydrateRoot(clientContainer, eventManager, {
        onRecoverableError: (error) => {
          recoverableErrors.push(
            error instanceof Error ? error : new Error(String(error)),
          )
        },
      })
    })
    const clientRows = eventRowTags(clientContainer)

    expect(serverRows).toEqual([
      ["LABEL", "DIV"],
      ["LABEL", "DIV"],
      ["LABEL", "DIV"],
    ])
    expect(clientRows).toEqual(serverRows)
    expect(recoverableErrors).toEqual([])
    expect(
      clientContainer.querySelectorAll('input[aria-hidden="true"]'),
    ).toHaveLength(0)

    await act(async () => clientRoot?.unmount())
  })

  // @lat: [[architecture#Tech Stack#SSR Theme Hydration#Stable Toggle Markup]]
  it("keeps theme-toggle markup stable from SSR through hydration", async () => {
    const serverMarkup = renderToString(<DarkModeToggle />)
    const serverContainer = document.createElement("div")
    serverContainer.innerHTML = serverMarkup
    const serverButton = serverContainer.querySelector("button")
    expect(serverButton).not.toBeNull()
    expect(childTags(serverButton as Element)).toEqual(["svg", "svg", "SPAN"])

    document.body.innerHTML = `<div id="root">${serverMarkup}</div>`
    const container = document.getElementById("root") as HTMLElement
    const recoverableErrors: Error[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <DarkModeToggle />, {
        onRecoverableError: (error) => {
          recoverableErrors.push(
            error instanceof Error ? error : new Error(String(error)),
          )
        },
      })
    })

    expect(recoverableErrors).toEqual([])
    expect(childTags(container.querySelector("button") as Element)).toEqual([
      "svg",
      "svg",
      "SPAN",
    ])

    await act(async () => root?.unmount())
  })
})
