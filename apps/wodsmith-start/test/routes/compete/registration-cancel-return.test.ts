import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  readData: vi.fn(),
  invite: vi.fn(),
  waivers: vi.fn(),
  questions: vi.fn(),
  addons: vi.fn(),
  divisions: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  redirect: (options: unknown) => options,
  notFound: () => new Error("Not found"),
}))
// Stub server-function transport while exercising the actual route loader.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: () => mocks.readData }),
  }),
}))
vi.mock("@/components/registration/registration-form", () => ({
  InviteRegistrationForm: () => null,
  PublicRegistrationForm: () => null,
}))
vi.mock("@/server-fns/registration-fns", () => ({
  cancelPendingPurchaseFn: mocks.cancel,
}))
vi.mock("@/server-fns/competition-divisions-fns", () => ({
  parseCompetitionSettings: () => ({
    divisions: { scalingGroupId: "group_a" },
  }),
  getPublicCompetitionDivisionsFn: mocks.divisions,
}))
vi.mock("@/server-fns/waiver-fns", () => ({
  getCompetitionWaiversFn: mocks.waivers,
}))
vi.mock("@/server-fns/registration-questions-fns", () => ({
  getCompetitionQuestionsFn: mocks.questions,
}))
vi.mock("@/server-fns/competition-addon-fns", () => ({
  getPublicCompetitionAddonsFn: mocks.addons,
}))

import { Route } from "@/routes/compete/$slug/register"

const route = Route as unknown as {
  loader: (context: unknown) => Promise<Record<string, unknown>>
}
function load(purchaseId: string | undefined = "purchase_a") {
  return route.loader({
    params: { slug: "test" },
    context: { session: { userId: "alice" } },
    deps: {
      canceled: "true",
      purchaseId,
      divisionId: "rx",
      invite: "invite_token",
    },
    parentMatchPromise: Promise.resolve({
      loaderData: {
        competition: {
          id: "comp_a",
          slug: "test",
          registrationOpensAt: null,
          registrationClosesAt: "2020-01-01",
          timezone: "America/Denver",
        },
      },
    }),
  })
}
beforeEach(() => {
  mocks.cancel.mockResolvedValue({ success: true })
  mocks.invite.mockResolvedValue({ priorTeam: null })
  mocks.readData.mockImplementation(
    async ({ data }: { data: Record<string, string> }) => {
      if (data.token) return mocks.invite(data.token)
      if (data.scalingGroupId)
        return {
          scalingGroup: { id: "group_a", scalingLevels: [{ id: "rx" }] },
        }
      if (data.competitionId)
        return {
          registeredDivisionIds: [],
          removedDivisionIds: [],
          previousAnswers: [],
          signedWaiverIds: [],
        }
      return { firstName: "Alice", email: "alice@example.com" }
    },
  )
  mocks.waivers.mockResolvedValue({ waivers: [{ id: "waiver_a" }] })
  mocks.questions.mockResolvedValue({ questions: [{ id: "question_a" }] })
  mocks.addons.mockResolvedValue({ addons: [] })
  mocks.divisions.mockResolvedValue({ divisions: [{ id: "rx" }] })
})
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Cancellation failure preserves registration loading]]
it.each(["Session already complete", "Stripe unavailable"])(
  "loads registration context when cancellation fails: %s",
  async (message) => {
    mocks.cancel.mockRejectedValueOnce(new Error(message))
    const result = await load()
    expect(result).toMatchObject({
      divisionsConfigured: true,
      registrationOpen: false,
      userId: "alice",
      waivers: [{ id: "waiver_a" }],
      questions: [{ id: "question_a" }],
      publicDivisions: [{ id: "rx" }],
    })
    expect(mocks.cancel).toHaveBeenCalledWith({
      data: {
        userId: "alice",
        competitionId: "comp_a",
        purchaseId: "purchase_a",
      },
    })
    expect(mocks.invite).toHaveBeenCalledWith("invite_token")
  },
)
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Cancellation return still releases owned checkout]]
it("keeps successful scoped cancellation and page loading intact", async () => {
  expect(await load()).toMatchObject({ divisionsConfigured: true })
  expect(mocks.cancel).toHaveBeenCalledTimes(1)
})
