// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { InviteSourcesList } from "@/components/organizer/invites/invite-sources-list"

const baseProps = {
  sources: [],
  competitionNamesById: {},
  seriesNamesById: {},
}

describe("organizer invite source empty state", () => {
  // @lat: [[ui-library#UI Library#Current boundary#Empty state composition#Direct organizer consumers#Crew invite sources empty action]]
  it("exposes the empty sources title and optional add action", () => {
    const onAdd = vi.fn()
    const { rerender } = render(
      <InviteSourcesList {...baseProps} onAdd={onAdd} />,
    )

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "No qualification sources yet",
      }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Add source" }))
    expect(onAdd).toHaveBeenCalledOnce()

    rerender(<InviteSourcesList {...baseProps} />)
    expect(screen.queryByRole("button", { name: "Add source" })).toBeNull()
  })
})
