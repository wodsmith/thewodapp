import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type {
  EnrichedRotation,
  EventWithRotations,
} from "@/server-fns/volunteer-schedule-fns"
import { ScheduleView } from "@/routes/compete/$slug/-components/schedule-view"
import { formatScheduleTimeRange } from "@/lib/volunteer-schedule-time"
vi.mock("@/routes/compete/$slug/-components/volunteer-profile-card", () => ({
  VolunteerProfileCard: () => null,
}))
const nativeDateTimeFormat = Intl.DateTimeFormat
beforeEach(() => {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    (locale, options) =>
      new nativeDateTimeFormat(locale, { timeZone: "Asia/Tokyo", ...options }),
  )
})
afterEach(cleanup)

// @lat: [[organizer-dashboard#Volunteers#Volunteer schedule local day groups]]
it("threads the event timezone through shifts and heat groups on My Schedule", () => {
  const rotation = {
    rotation: {
      id: "rotation",
      startingLane: 1,
      startingHeat: 1,
      laneShiftPattern: "stay",
    },
    isUpcoming: true,
    heats: [
      {
        heatNumber: 1,
        scheduledTime: new Date("2026-09-06T06:30:00Z"),
        divisionId: null,
      },
      {
        heatNumber: 2,
        scheduledTime: new Date("2026-09-06T07:30:00Z"),
        divisionId: null,
      },
    ],
  } as EnrichedRotation
  const event = {
    trackWorkoutId: "event",
    eventName: "Event One",
    workout: { scheme: "time", description: null },
    rotations: [rotation],
    divisionDescriptions: [],
    judgingSheets: [],
  } as unknown as EventWithRotations
  render(
    <ScheduleView
      competitionName="Test"
      competitionSlug="test"
      membershipId="member"
      competitionStartDate="2026-09-05"
      competitionEndDate="2026-09-06"
      volunteerMetadata={null}
      timezone="America/Los_Angeles"
      events={[event]}
      shifts={[
        {
          id: "shift",
          name: "Check-in",
          roleType: "check_in",
          startTime: new Date("2026-09-06T06:30:00Z"),
          endTime: new Date("2026-09-06T07:30:00Z"),
          location: null,
          notes: null,
        },
      ]}
    />,
  )
  expect(
    screen.getByText("All times shown in America/Los_Angeles."),
  ).toBeInTheDocument()
  expect(
    screen.getByText("Sat, Sep 5 11:30 PM - Sun, Sep 6 12:30 AM"),
  ).toBeInTheDocument()
  expect(
    screen.getByRole("heading", { name: "Sat, Sep 5" }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole("heading", { name: "Sun, Sep 6" }),
  ).toBeInTheDocument()
  expect(screen.getByText("11:30 PM")).toBeInTheDocument()
  expect(screen.getByText("12:30 AM")).toBeInTheDocument()
})

// @lat: [[organizer-dashboard#Volunteers#Volunteer schedule same local day]]
it("keeps UTC-midnight ranges together when they are one event-local day", () => {
  expect(
    formatScheduleTimeRange(
      new Date("2026-09-06T23:30:00Z"),
      new Date("2026-09-07T00:30:00Z"),
      "America/Los_Angeles",
      true,
    ),
  ).toBe("Sun, Sep 6 4:30 PM - 5:30 PM")
})

it("applies the event timezone's daylight-saving offset to each endpoint", () => {
  expect(
    formatScheduleTimeRange(
      new Date("2026-03-08T09:30:00Z"),
      new Date("2026-03-08T10:30:00Z"),
      "America/Los_Angeles",
    ),
  ).toBe("1:30 AM - 3:30 AM")
})
