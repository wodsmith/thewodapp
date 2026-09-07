import { expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({ rows: [] as unknown[][], writes: vi.fn() }))
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => {
    const rows = fixture.rows.shift() ?? []
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve) }
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) chain[method] = () => chain
    return chain
  },
  insert: fixture.writes, update: fixture.writes, delete: fixture.writes,
}) }))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({ handler: (fn: unknown) => fn, inputValidator: (parse: (data: unknown) => unknown) => ({ handler: (fn: (ctx: {data: unknown}) => unknown) => (ctx: {data: unknown}) => fn({ data: parse(ctx.data) }) }) }),
}))
import * as copiedVolunteerEndpoints from "@/server-fns/volunteer-fns"
import { getCrewVolunteerScheduleTokenFn } from "@/server-fns/crew-volunteer-fns"

// @lat: [[volunteer-confirmation#Volunteer email confirmation#Crew public token boundary]]
it("removes the copied account-upgrade endpoint while retaining the active token-scoped schedule flow", async () => {
  expect(copiedVolunteerEndpoints).not.toHaveProperty("createAccountAndApplyAsVolunteerFn")
  fixture.rows = [[{
    event: { id: "comp_crew", slug: "crew-event", name: "Crew Event", description: null, startDate: "2026-09-07", endDate: "2026-09-08", timezone: "America/Boise", competitionTeamId: "team_crew" },
    invitation: { id: "tinv_crew", email: "owner@example.com", token: "mailed-token", status: "pending", acceptedAt: null, acceptedBy: null, expiresAt: new Date(Date.now() + 60_000), metadata: { signupName: "Mailbox Owner", signupEmail: "owner@example.com", inviteSource: "volunteer_signup" } },
  }], []]
  const result = await getCrewVolunteerScheduleTokenFn({ data: { slug: "crew-event", token: "mailed-token" } })
  expect(result).toMatchObject({ status: "valid", event: { slug: "crew-event" }, volunteer: { email: "owner@example.com" }, assignments: [] })
  expect(fixture.writes).not.toHaveBeenCalled()
})
