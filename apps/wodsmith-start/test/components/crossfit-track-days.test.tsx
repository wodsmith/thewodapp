import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CrossFitTrackDays } from "@/components/crossfit-track-days"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: React.ReactNode
    params: { workoutId: string }
  }) => <a href={`/workouts/${params.workoutId}`}>{children}</a>,
}))

describe("CrossFit dated track feed", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Rest and component display]]
  it("shows source attribution and grouped scores while leaving rest days unscoreable", () => {
    const { rerender } = render(
      <CrossFitTrackDays
        days={[
          {
            id: "rest",
            date: "2026-09-06",
            url: "https://www.crossfit.com/260906",
            kind: "rest",
            markdown: "**Rest Day**",
            workouts: [],
          },
          {
            id: "work",
            date: "2026-09-04",
            url: "https://www.crossfit.com/260904",
            kind: "workout",
            markdown: "For time, then lift.",
            workouts: [
              {
                importId: "work",
                workoutId: "time",
                name: "Timed part",
                scheme: "time",
              },
              {
                importId: "work",
                workoutId: "load",
                name: "Load part",
                scheme: "load",
              },
            ],
          },
        ]}
      />,
    )
    expect(
      screen.getByRole("heading", { name: "Rest day" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "View on CrossFit.com" }),
    ).toHaveAttribute("href", "https://www.crossfit.com/260906")
    expect(screen.queryByText("Add to my day")).not.toBeInTheDocument()
    rerender(
      <CrossFitTrackDays
        selectedDate="2026-09-04"
        days={[
          {
            id: "work",
            date: "2026-09-04",
            url: "https://www.crossfit.com/260904",
            kind: "workout",
            markdown: "For time, then lift.",
            workouts: [
              { workoutId: "time", name: "Timed part", scheme: "time" },
              { workoutId: "load", name: "Load part", scheme: "load" },
            ],
          },
        ]}
      />,
    )
    expect(
      screen
        .getAllByRole("link", { name: "View workout" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/workouts/time", "/workouts/load"])
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Deferred programming text]]
  it("mounts Markdown only while a day's programming is expanded", () => {
    render(
      <CrossFitTrackDays
        days={[
          {
            id: "day",
            date: "2026-09-06",
            url: "https://www.crossfit.com/260906",
            kind: "rest",
            markdown: "Unique programming text",
            workouts: [],
          },
        ]}
      />,
    )
    expect(
      screen.queryByText("Unique programming text"),
    ).not.toBeInTheDocument()
    const details = screen
      .getByText("Read programming and scaling")
      .closest("details")!
    details.open = true
    fireEvent(details, new Event("toggle"))
    expect(screen.getByText("Unique programming text")).toBeInTheDocument()
    details.open = false
    fireEvent(details, new Event("toggle"))
    expect(
      screen.queryByText("Unique programming text"),
    ).not.toBeInTheDocument()
  })
})
