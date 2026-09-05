import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Waiver } from "@/db/schemas/waivers"
import type { CheckInRegistration } from "@/server-fns/check-in-fns"

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  checkIn: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/check-in-fns", () => ({
  searchCompetitionRegistrationsFn: mocks.search,
  checkInRegistrationFn: mocks.checkIn,
}))
vi.mock(
  "@/routes/compete/$slug/check-in/-components/check-in-waiver-dialog",
  () => ({
    CheckInWaiverDialog: ({ onSigned }: { onSigned: (at: string) => void }) => (
      <button type="button" onClick={() => onSigned("2026-09-05T12:00:00Z")}>
        Complete waiver
      </button>
    ),
  }),
)
import { CheckInKiosk } from "@/routes/compete/$slug/check-in/-components/check-in-kiosk"

const row: CheckInRegistration = {
  id: "registration",
  teamName: null,
  divisionId: "division",
  divisionLabel: "RX",
  status: "active",
  checkedInAt: null,
  checkedInBy: null,
  registeredAt: "2026-09-01T00:00:00Z",
  pendingTeammates: [],
  members: [
    {
      membershipId: "membership",
      userId: "athlete",
      firstName: "Alex",
      lastName: "Jones",
      email: "alex@example.com",
      avatar: null,
      isCaptain: true,
      signedWaivers: {},
    },
  ],
}
const response = (checkedIn = 60, waiversMissing = 20) => ({
  registrations: [row],
  summary: {
    total: 120,
    checkedIn,
    pending: 120 - checkedIn,
    waiversMissing,
    percent: Math.round((checkedIn / 120) * 100),
  },
})
const waiver = {
  id: "waiver",
  title: "Athlete waiver",
  required: true,
  content: "Terms",
} as Waiver

beforeEach(() => {
  mocks.search.mockResolvedValue(response())
  mocks.checkIn.mockResolvedValue({
    checkedInAt: "2026-09-05T12:00:00Z",
    checkedInBy: "volunteer",
  })
})
afterEach(cleanup)

describe("check-in kiosk totals", () => {
  // @lat: [[registration#Day-of Check-In#Kiosk uses server summary]]
  it("uses full server totals rather than the returned row count", async () => {
    render(<CheckInKiosk competitionId="competition" waivers={[waiver]} />)
    expect(await screen.findByText("/ 120")).toBeInTheDocument()
    expect(screen.getByText("(50%)")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Check in" }),
    ).not.toBeInTheDocument()
    fireEvent.change(
      screen.getByPlaceholderText("Search athlete name, email, or team…"),
      { target: { value: "Alex" } },
    )
    expect(
      await screen.findByText(/Showing 1 of 120 matching registrations/),
    ).toBeInTheDocument()
    expect(screen.getByText("Matching · Checked In")).toBeInTheDocument()
  })

  // @lat: [[registration#Day-of Check-In#Kiosk refreshes after local updates]]
  it.each(["check-in", "waiver"])(
    "refetches aggregate once after a successful %s",
    async (action) => {
      render(<CheckInKiosk competitionId="competition" waivers={[waiver]} />)
      await screen.findByText("/ 120")
      fireEvent.change(
        screen.getByPlaceholderText("Search athlete name, email, or team…"),
        { target: { value: "Alex" } },
      )
      const checkInButton = await screen.findByRole("button", {
        name: "Check in",
      })
      const callsBefore = mocks.search.mock.calls.length
      mocks.search.mockResolvedValue(response(72, 0))
      if (action === "check-in") fireEvent.click(checkInButton)
      else {
        fireEvent.click(screen.getByRole("button", { name: "Sign on iPad" }))
        fireEvent.click(screen.getByRole("button", { name: "Complete waiver" }))
      }
      await screen.findByText("(60%)")
      await waitFor(() =>
        expect(mocks.search).toHaveBeenCalledTimes(callsBefore + 1),
      )
      expect(mocks.search).toHaveBeenLastCalledWith({
        data: { competitionId: "competition", query: "Alex" },
      })
    },
  )
})
