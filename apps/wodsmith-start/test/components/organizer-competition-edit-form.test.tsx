import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerCompetitionEditForm } from "@/routes/compete/organizer/$competitionId/-components/organizer-competition-edit-form"

const updateCompetitionFnMock = vi.hoisted(() => vi.fn())

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: vi.fn(), invalidate: vi.fn() }),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}))

vi.mock("@/server-fns/competition-fns", () => ({
  updateCompetitionFn: updateCompetitionFnMock,
}))

vi.mock("@/components/forms/address-fields", () => ({
  AddressFields: () => <div data-testid="address-fields">Address fields</div>,
}))

vi.mock("@/components/ui/image-upload", () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}))

type EditCompetition = ComponentProps<
  typeof OrganizerCompetitionEditForm
>["competition"]

beforeAll(() => {
  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

function createCompetition(competitionType: string): EditCompetition {
  return {
    id: "comp_test",
    organizingTeamId: "team_org",
    competitionTeamId: "team_event",
    groupId: null,
    slug: "benchmark-board",
    name: "Benchmark Board",
    description: null,
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    registrationOpensAt: null,
    registrationClosesAt: null,
    timezone: "America/Boise",
    settings: null,
    defaultRegistrationFeeCents: 0,
    platformFeePercentage: 0,
    platformFeeFixed: 0,
    passStripeFeesToCustomer: false,
    passPlatformFeesToCustomer: false,
    visibility: "public",
    status: "draft",
    competitionType,
    profileImageUrl: null,
    bannerImageUrl: null,
    defaultHeatsPerRotation: null,
    defaultLaneShiftPattern: null,
    defaultMaxSpotsPerDivision: null,
    maxTotalRegistrations: null,
    primaryAddressId: "addr_test",
    primaryAddress: {
      name: "Test Venue",
      streetLine1: "123 Main St",
      streetLine2: null,
      city: "Boise",
      stateProvince: "ID",
      postalCode: "83702",
      countryCode: "US",
      notes: null,
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    updateCounter: 0,
  } as EditCompetition
}

describe("OrganizerCompetitionEditForm", () => {
  beforeEach(() => {
    updateCompetitionFnMock.mockReset()
    updateCompetitionFnMock.mockResolvedValue({})
  })

  // @lat: [[competition-type-capabilities#Venue and Volunteer Gates Test#Edit Form Physical Venue Gate]]
  it("hides venue fields for stored benchmark competitions and omits address updates", async () => {
    render(
      <OrganizerCompetitionEditForm
        competition={createCompetition("benchmark")}
        groups={[]}
      />,
    )

    expect(screen.queryByRole("heading", { name: "Location" })).toBeNull()
    expect(screen.queryByTestId("address-fields")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(updateCompetitionFnMock).toHaveBeenCalled()
    })

    const [{ data }] = updateCompetitionFnMock.mock.calls[0]
    expect(data.competitionId).toBe("comp_test")
    expect(Object.hasOwn(data, "address")).toBe(true)
    expect(data.address).toBeUndefined()
  })

  it("keeps venue fields visible for stored in-person competitions", () => {
    render(
      <OrganizerCompetitionEditForm
        competition={createCompetition("in-person")}
        groups={[]}
      />,
    )

    expect(screen.getByRole("heading", { name: "Location" })).toBeInTheDocument()
    expect(screen.getByTestId("address-fields")).toBeInTheDocument()
  })
})
