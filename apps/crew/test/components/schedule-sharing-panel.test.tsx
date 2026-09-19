import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { CrewScheduleSharingPanel } from "@/components/crew/schedule-sharing-panel"
import type { CrewPublishedScheduleManagerData } from "@/server/crew-published-schedule.server"

const { unpublish, publish, refresh } = vi.hoisted(() => ({
  unpublish: vi.fn(), publish: vi.fn(), refresh: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => <a href={to} className={className}>{children}</a>,
}))
vi.mock("@/server-fns/crew-published-schedule-fns", () => ({
  unpublishCrewScheduleFn: unpublish,
  publishCrewScheduleFn: publish,
  getCrewPublishedScheduleManagerFn: refresh,
}))

const release: CrewPublishedScheduleManagerData = {
  event: { id: "event-one", name: "Fall Throwdown", slug: "fall-throwdown" },
  hasAccess: true,
  sharePath: "/e/fall-throwdown/schedule",
  published: {
    version: 1,
    publishedAt: "2026-10-20T12:00:00.000Z",
    event: { name: "Fall Throwdown", slug: "fall-throwdown", timezone: "America/Denver", startDate: "2026-10-24", endDate: "2026-10-25" },
    volunteers: [],
  },
  preview: null,
  previewError: "Review your draft assignments and refresh the preview.",
  draftChanged: false,
}

describe("schedule publication recovery", () => {
  // @lat: [[crew#Published Volunteer Schedule]]
  it("lets an organizer inspect and unpublish a release when the current draft fails validation", async () => {
    unpublish.mockResolvedValue({ ...release, published: null })
    render(<CrewScheduleSharingPanel initialData={release} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Review your draft")
    expect(screen.getByRole("button", { name: "Publish changes" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Published version" }))
    expect(screen.getByRole("heading", { name: "Fall Throwdown" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your schedule is a draft" })).toBeVisible())
    expect(unpublish).toHaveBeenCalledWith({ data: { eventId: "event-one" } })
    expect(screen.queryByLabelText("Volunteer schedule link")).not.toBeInTheDocument()
    expect(publish).not.toHaveBeenCalled()
  })

  it("shows inactive access honestly and still lets an organizer take the saved release offline", async () => {
    const inactive = { ...release, hasAccess: false }
    unpublish.mockResolvedValue({ ...inactive, published: null })
    render(<CrewScheduleSharingPanel initialData={inactive} />)
    expect(screen.getByRole("heading", { name: "Your published link is unavailable" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your schedule is a draft" })).toBeVisible())
    expect(unpublish).toHaveBeenCalledWith({ data: { eventId: "event-one" } })
  })

  it("copies the current event name and slug into the volunteer message", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<CrewScheduleSharingPanel initialData={release} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Copy volunteer message" }),
    )

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("schedule for Fall Throwdown is ready"),
    )
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/e/fall-throwdown/schedule"),
    )
    expect(writeText).not.toHaveBeenCalledWith(
      expect.stringContaining("mountain-west-fitness-championship"),
    )
  })
})
