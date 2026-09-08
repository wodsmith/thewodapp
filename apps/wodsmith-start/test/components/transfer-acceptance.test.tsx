import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({
  accept: vi.fn(),
  navigate: vi.fn(),
  invalidate: vi.fn(),
  session: { userId: "target", email: "target@example.com" } as {
    userId: string
    email: string
  } | null,
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useParams: () => ({ slug: "competition" }),
    useLoaderData: () => ({
      transferId: "transfer",
      transfer: {
        transferState: "INITIATED",
        expiresAt: new Date(Date.now() + 86_400_000),
        sourceUser: { firstName: "Source", lastName: "Athlete" },
        targetEmail: "target@example.com",
        competition: { name: "Competition", slug: "competition" },
        division: null,
        team: null,
        teammates: [],
      },
      session: fixture.session,
      questions: [],
      waivers: [
        { id: "waiver", title: "Event waiver", content: "{}", required: true },
      ],
    }),
  }),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/competition">{children}</a>
  ),
  useRouter: () => ({
    navigate: fixture.navigate,
    invalidate: fixture.invalidate,
  }),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/purchase-transfer-accept-fns", () => ({
  acceptPurchaseTransferFn: (...args: unknown[]) => fixture.accept(...args),
  getPendingTransferFn: vi.fn(),
  getTransferSessionFn: vi.fn(),
}))
vi.mock("@/server-fns/registration-questions-fns", () => ({
  getCompetitionQuestionsFn: vi.fn(),
}))
vi.mock("@/server-fns/waiver-fns", () => ({ getCompetitionWaiversFn: vi.fn() }))
vi.mock("@/components/compete/waiver-viewer", () => ({
  WaiverViewer: () => <p>Waiver content</p>,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { Route as TransferRoute } from "@/routes/transfer/$transferId"
import { Route as RecoveryRoute } from "@/routes/compete/$slug/invite-pending"

const TransferPage = TransferRoute.options.component as ComponentType
const RecoveryPage = RecoveryRoute.options.component as ComponentType

beforeEach(() => {
  fixture.session = { userId: "target", email: "target@example.com" }
  fixture.accept.mockResolvedValue({ success: true })
})

describe("transfer acceptance", () => {
  // @lat: [[transfer-integrity-tests#Transfer integrity#Signature form payload]]
  it("requires agreement and sends the exact name typed into the signature field", async () => {
    render(<TransferPage />)
    expect(
      screen.getByRole("button", {
        name: "Complete all required fields to accept",
      }),
    ).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Full Name/), {
      target: { value: "  Taylor J. Athlete  " },
    })
    expect(
      screen.getByRole("button", {
        name: "Complete all required fields to accept",
      }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Accept transfer" }))
    await waitFor(() =>
      expect(fixture.accept).toHaveBeenCalledWith({
        data: {
          transferId: "transfer",
          answers: undefined,
          waiverSignatures: [
            { waiverId: "waiver", signatureName: "  Taylor J. Athlete  " },
          ],
        },
      }),
    )
  })

  // @lat: [[transfer-integrity-tests#Transfer integrity#Neutral invite recovery]]
  it("offers truthful recovery instructions without assuming a signed-in account", () => {
    fixture.session = null
    render(<RecoveryPage />)
    expect(
      screen.getByText("Use the account that received the invitation."),
    ).toBeInTheDocument()
    expect(screen.getByText(/If prompted, sign in/)).toBeInTheDocument()
    expect(
      screen.queryByText(/signed in with the right account/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Go to competition page" }),
    ).toBeInTheDocument()
  })
})
