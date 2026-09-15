import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CrewPublicScheduleView } from "@/components/crew/public-schedule-view"
import type { CrewPublishedSchedule } from "@/lib/crew/published-schedule"

const schedule: CrewPublishedSchedule = {
  version: 1,
  publishedAt: "2026-10-20T12:00:00.000Z",
  event: { name: "Fall Throwdown", slug: "fall-throwdown", timezone: "America/Denver", startDate: "2026-10-24", endDate: "2026-10-25" },
  volunteers: [
    { id: "alex-one-123456", name: "Álex Lee", assignments: [
      { id: "shift-one", kind: "shift", title: "Morning judging", roleLabel: "Judge", startTime: "2026-10-24T14:00:00.000Z", endTime: "2026-10-24T16:00:00.000Z", location: "Main floor", heatNumber: null, laneNumber: null },
      { id: "heat-two", kind: "judge", title: "Final workout", roleLabel: "Judge", startTime: "2026-10-25T17:00:00.000Z", endTime: "2026-10-25T17:15:00.000Z", location: "Outdoor floor", heatNumber: 3, laneNumber: 4 },
    ] },
    { id: "alex-two-654321", name: "Alex Lee", assignments: [
      { id: "check-in", kind: "shift", title: "Athlete check-in", roleLabel: "Check-in", startTime: "2026-10-24T13:00:00.000Z", endTime: "2026-10-24T14:00:00.000Z", location: "Front desk", heatNumber: null, laneNumber: null },
    ] },
  ],
}

describe("published volunteer schedule", () => {
  // @lat: [[crew#Published Volunteer Schedule]]
  it("finds accented and duplicate names without login and shows both days of shift and judge duties", () => {
    render(<CrewPublicScheduleView schedule={schedule} />)
    fireEvent.change(screen.getByLabelText("Find your name"), { target: { value: "alex" } })
    expect(screen.getByRole("status")).toHaveTextContent("2 volunteers found")
    expect(screen.getByText(/Roster reference 123456/)).toBeVisible()
    expect(screen.getByText(/Roster reference 654321/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "View Álex Lee's schedule" }))
    expect(screen.getByText("Morning judging")).toBeVisible()
    expect(screen.getByText("Final workout")).toBeVisible()
    expect(screen.getByText("Judge · Heat 3 · Lane 4")).toBeVisible()
    expect(screen.getByText("Saturday, October 24")).toBeVisible()
    expect(screen.getByText("Sunday, October 25")).toBeVisible()
    expect(screen.getByText("8:00 AM – 10:00 AM")).toBeVisible()
    expect(screen.getByText("Outdoor floor")).toBeVisible()
  })

  it("offers a useful empty search and lets someone choose the other volunteer", () => {
    render(<CrewPublicScheduleView schedule={schedule} />)
    fireEvent.change(screen.getByLabelText("Find your name"), { target: { value: "nobody" } })
    expect(screen.getByRole("status")).toHaveTextContent("No matching names")
    fireEvent.change(screen.getByLabelText("Find your name"), { target: { value: "lee" } })
    fireEvent.click(screen.getByRole("button", { name: "View Alex Lee's schedule" }))
    expect(screen.getByText("Athlete check-in")).toBeVisible()
    expect(screen.queryByText("Final workout")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Find another name" }))
    expect(screen.getByLabelText("Find your name")).toHaveValue("lee")
  })

  it("prints a selected published schedule, with no print control in the draft preview", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {})
    const { unmount } = render(<CrewPublicScheduleView schedule={schedule} />)
    fireEvent.change(screen.getByLabelText("Find your name"), { target: { value: "alex" } })
    fireEvent.click(screen.getByRole("button", { name: "View Alex Lee's schedule" }))
    fireEvent.click(screen.getByRole("button", { name: "Print my schedule" }))
    expect(print).toHaveBeenCalledOnce()
    unmount()
    render(<CrewPublicScheduleView schedule={schedule} preview />)
    fireEvent.change(screen.getByLabelText("Find your name"), { target: { value: "alex" } })
    fireEvent.click(screen.getByRole("button", { name: "View Alex Lee's schedule" }))
    expect(screen.queryByRole("button", { name: "Print my schedule" })).not.toBeInTheDocument()
  })
})
