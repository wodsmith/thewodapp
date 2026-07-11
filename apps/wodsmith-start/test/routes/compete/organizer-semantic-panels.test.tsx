// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CheckInInstructions } from "@/routes/compete/organizer/$competitionId/-components/check-in-instructions"
import { ResultsLoadError } from "@/routes/compete/organizer/$competitionId/-components/results-load-error"

describe("organizer semantic panels", () => {
  // @lat: [[organizer-dashboard#Semantic Organizer Panels Tests#Check-In Instructions Use Link Semantics]]
  it("presents check-in instructions with a new-tab kiosk link", () => {
    render(<CheckInInstructions competitionSlug="test-throwdown" />)

    const section = screen.getByRole("region", { name: "Day-of check-in" })
    expect(section).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Day-of check-in" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/tap check in to mark their whole team as arrived/i),
    ).toBeInTheDocument()

    const kioskLink = screen.getByRole("link", {
      name: /open check-in kiosk/i,
    })
    expect(kioskLink).toHaveAttribute(
      "href",
      "/compete/test-throwdown/check-in",
    )
    expect(kioskLink).toHaveAttribute("target", "_blank")
    expect(kioskLink).toHaveAttribute("rel", "noopener noreferrer")
  })

  // @lat: [[organizer-dashboard#Semantic Organizer Panels Tests#Results Load Failure Exposes Retry]]
  it("announces a results load failure and retries through the supplied action", () => {
    const onRetry = vi.fn()

    render(<ResultsLoadError onRetry={onRetry} />)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Unable to load results")
    expect(alert).toHaveTextContent(
      "Unable to load score entry data. Please try again.",
    )

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
