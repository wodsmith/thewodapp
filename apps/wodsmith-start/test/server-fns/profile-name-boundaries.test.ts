import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { signUpSchema } from "@/schemas/auth.schema"
import { updateUserProfileFn } from "@/server-fns/profile-fns"
import { createAccountAndApplyAsVolunteerFn } from "@/server-fns/volunteer-fns"
import { getSessionFromCookie } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"

const db = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: vi.fn() }))
vi.mock("@/utils/kv-session", () => ({ updateAllSessionsOfUser: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({
    handler: (handler: unknown) => handler,
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (handler: (ctx: { data: unknown }) => unknown) =>
        (ctx: { data: unknown }) =>
          handler({ data: validate(ctx.data) }),
    }),
  }),
}))

describe("account name boundaries", () => {
  beforeEach(() => {
    db.reset()
    vi.mocked(getSessionFromCookie).mockResolvedValue({
      userId: "usr_owner",
    } as never)
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Normalized names]]
  it.each([" A ", " 李 ", ` ${"a".repeat(255)} `])(
    "saves valid trimmed names through signup and profile: %s",
    async (name) => {
      const signup = signUpSchema.parse({
        firstName: name,
        lastName: name,
        email: "owned@example.com",
        password: "Password123",
      })
      expect(signup.firstName).toBe(name.trim())
      expect(signup.lastName).toBe(name.trim())
      await updateUserProfileFn({ data: { firstName: name, lastName: name } })
      expect(db.update).toHaveBeenCalled()
      expect(db.getChainMock().set).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: name.trim(),
          lastName: name.trim(),
        }),
      )
      expect(updateAllSessionsOfUser).toHaveBeenCalledWith("usr_owner")
    },
  )

  // @lat: [[auth-boundary-tests#Account boundary regressions#Invalid names]]
  it.each(["", " \t\n ", "a".repeat(256)])(
    "rejects blank or oversized names before database writes: %s",
    async (name) => {
      expect(
        signUpSchema.safeParse({
          firstName: name,
          lastName: name,
          email: "owned@example.com",
          password: "Password123",
        }).success,
      ).toBe(false)
      await expect(async () =>
        updateUserProfileFn({ data: { firstName: name, lastName: name } }),
      ).rejects.toThrow()
      expect(db.update).not.toHaveBeenCalled()
      expect(updateAllSessionsOfUser).not.toHaveBeenCalled()
    },
  )

  // @lat: [[auth-boundary-tests#Account boundary regressions#Profile authorization]]
  it("requires an authenticated owner before changing names", async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null)
    await expect(
      updateUserProfileFn({ data: { firstName: "Ada", lastName: "Lovelace" } }),
    ).rejects.toThrow("Not authenticated")
    expect(db.update).not.toHaveBeenCalled()
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Volunteer name validation]]
  it.each(["", " \t ", "a".repeat(256)])(
    "rejects invalid volunteer account names before side effects",
    async (name) => {
      await expect(async () =>
        createAccountAndApplyAsVolunteerFn({
          data: {
            firstName: name,
            lastName: name,
            password: "Password123",
            signupEmail: "owned@example.com",
            signupName: "Test User",
            competitionTeamId: "team_competition",
            availability: "all_day",
            website: "honeypot",
          },
        }),
      ).rejects.toThrow()
      expect(db.update).not.toHaveBeenCalled()
      expect(db.insert).not.toHaveBeenCalled()
    },
  )
})
