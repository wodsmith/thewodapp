// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/forms/address-fields", () => ({
  AddressFields: () => null,
}))

vi.mock("@/server-fns/address-fns", () => ({
  createAddressFn: vi.fn(),
}))

vi.mock("@/server-fns/competition-heats-fns", () => ({
  createVenueFn: vi.fn(),
  deleteVenueFn: vi.fn(),
  getVenueHeatCountFn: vi.fn(),
  updateVenueFn: vi.fn(),
}))

import { VenueManager } from "@/components/organizer/schedule/venue-manager"

describe("organizer venue empty state", () => {
  // @lat: [[ui-library#UI Library#Current boundary#Empty state composition#Direct organizer consumers#Crew venue empty action]]
  it("keeps the empty venue action beneath the Venues section", () => {
    render(<VenueManager competitionId="competition_1" venues={[]} />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Venues" }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { level: 3, name: "No venues yet" }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Add venue" }))

    expect(screen.getByRole("dialog")).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Create venue" }),
    ).toBeVisible()
  })
})
