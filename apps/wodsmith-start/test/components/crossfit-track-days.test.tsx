import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CrossFitTrackDays } from "@/components/crossfit-track-days"

vi.mock("@tanstack/react-router", () => ({ Link: ({ children, params }: { children: React.ReactNode, params: { workoutId: string } }) => <a href={`/workouts/${params.workoutId}`}>{children}</a> }))

describe("CrossFit dated track feed", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Rest and component display]]
  it("shows source attribution and grouped scores while leaving rest days unscoreable", () => {
    render(<CrossFitTrackDays days={[
      { id: "rest", date: "2026-09-06", url: "https://www.crossfit.com/260906", kind: "rest", markdown: "**Rest Day**", workouts: [] },
      { id: "work", date: "2026-09-04", url: "https://www.crossfit.com/260904", kind: "workout", markdown: "For time, then lift.", workouts: [
        { importId: "work", workoutId: "time", name: "Timed part", scheme: "time" },
        { importId: "work", workoutId: "load", name: "Load part", scheme: "load" },
      ] },
    ]} />)
    expect(screen.getByRole("heading", { name: "2026-09-06 · Rest Day" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "View on CrossFit.com" })).toHaveLength(2)
    expect(screen.getByRole("link", { name: "Timed part · time" })).toHaveAttribute("href", "/workouts/time")
    expect(screen.getByRole("link", { name: "Load part · load" })).toHaveAttribute("href", "/workouts/load")
    expect(screen.queryByRole("button", { name: /score/i })).not.toBeInTheDocument()
  })
})
