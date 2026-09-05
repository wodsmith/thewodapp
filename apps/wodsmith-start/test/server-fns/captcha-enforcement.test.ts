import { FakeDrizzleDb } from "@repo/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runtime = vi.hoisted(() => ({
  NODE_ENV: "development",
  TURNSTILE_SITE_KEY: "test-public-site-key",
  TURNSTILE_SECRET_KEY: undefined as string | undefined,
  KV_SESSION: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
const auth = vi.hoisted(() => ({
  canSignUp: vi.fn(),
  createAndStoreSession: vi.fn(),
  getSessionFromCookie: vi.fn(),
}))
const email = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}))
const mockDb = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => mockDb }))
vi.mock("cloudflare:workers", () => ({ env: runtime }))
vi.mock("@/utils/auth", () => auth)
vi.mock("@/utils/email", () => email)
vi.mock("@/utils/kv-session", () => ({ updateAllSessionsOfUser: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: <T>(fn: T) => fn,
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: (validator: (input: unknown) => unknown) => ({
      handler: (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        ({ data }: { data: unknown }) => fn({ data: validator(data) }),
    }),
  }),
}))

import { getTurnstileConfig, getTurnstileConfigFn } from "@/lib/env"
import { forgotPasswordFn, signUpFn } from "@/server-fns/auth-fns"
import { submitOrganizerRequestFn } from "@/server-fns/organizer-onboarding-fns"
import { validateTurnstileToken } from "@/utils/validate-captcha"

const fetchMock = vi.fn<typeof fetch>()
const signupData = {
  email: "captcha@example.com",
  firstName: "Test",
  lastName: "Athlete",
  password: "TestPassword1",
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("PROD", false)
  runtime.NODE_ENV = "development"
  runtime.TURNSTILE_SITE_KEY = "test-public-site-key"
  runtime.TURNSTILE_SECRET_KEY = "test-only-secret"
  mockDb.reset()
  mockDb.registerTable("userTable")
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("server-owned CAPTCHA policy", () => {
  // @lat: [[auth#CAPTCHA tests#Trusted configuration]]
  it("publishes the runtime site key without exposing the secret", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "")
    expect(await getTurnstileConfigFn()).toEqual({ enabled: true, siteKey: runtime.TURNSTILE_SITE_KEY })
  })

  // @lat: [[auth#CAPTCHA tests#Disabled development]]
  it("allows explicitly unconfigured local development without calling the provider", async () => {
    runtime.TURNSTILE_SECRET_KEY = undefined
    expect(getTurnstileConfig().enabled).toBe(false)
    expect(await validateTurnstileToken()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // @lat: [[auth#CAPTCHA tests#Missing production secret]]
  it.each(["runtime", "build"])("fails closed with a missing secret in %s production", async (mode) => {
    runtime.TURNSTILE_SECRET_KEY = undefined
    if (mode === "runtime") runtime.NODE_ENV = "production"
    else vi.stubEnv("PROD", true)
    await expect(getTurnstileConfigFn()).rejects.toThrow("temporarily unavailable")
    await expect(validateTurnstileToken("token")).rejects.toThrow("temporarily unavailable")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // @lat: [[auth#CAPTCHA tests#Missing public site key]]
  it("fails closed when a configured deployment is missing its public key", async () => {
    runtime.TURNSTILE_SITE_KEY = ""
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "")
    await expect(validateTurnstileToken("token")).rejects.toThrow("temporarily unavailable")
  })

  // @lat: [[auth#CAPTCHA tests#Missing token validation]]
  it.each([undefined, "", "   "])("rejects a missing or blank token (%s) without calling the provider", async (token) => {
    expect(await validateTurnstileToken(token)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // @lat: [[auth#CAPTCHA tests#Successful provider result]]
  it("accepts an explicitly successful provider result", async () => {
    expect(await validateTurnstileToken("token")).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // @lat: [[auth#CAPTCHA tests#Rejected provider result]]
  it.each([false, "true", null])("rejects unsuccessful or malformed success values (%s)", async (success) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success })))
    expect(await validateTurnstileToken("token")).toBe(false)
  })

  // @lat: [[auth#CAPTCHA tests#Failed provider HTTP status]]
  it("rejects non-successful HTTP responses even if their body claims success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 503 }))
    expect(await validateTurnstileToken("token")).toBe(false)
  })
})

describe("protected server functions", () => {
  const attempts = [
    { name: "signup", run: (token?: string) => signUpFn({ data: { ...signupData, captchaToken: token } }) },
    { name: "password reset email", run: (token?: string) => forgotPasswordFn({ data: { email: signupData.email, captchaToken: token } }) },
    { name: "organizer request", run: (token?: string) => submitOrganizerRequestFn({ data: { teamId: "test-team", reason: "Organize a local competition", captchaToken: token } }) },
  ]

  // @lat: [[auth#CAPTCHA tests#Missing and rejected challenges]]
  it.each(attempts)("blocks $name before side effects when token is omitted", async ({ run }) => {
    await expect(run()).rejects.toThrow(/captcha/i)
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(runtime.KV_SESSION.put).not.toHaveBeenCalled()
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled()
    expect(email.sendVerificationEmail).not.toHaveBeenCalled()
    expect(auth.canSignUp).not.toHaveBeenCalled()
    expect(auth.getSessionFromCookie).not.toHaveBeenCalled()
  })

  // @lat: [[auth#CAPTCHA tests#Rejected handler challenges]]
  it.each(attempts)("blocks $name on a rejected challenge", async ({ run }) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false })))
    await expect(run("bad-token")).rejects.toThrow(/captcha/i)
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(runtime.KV_SESSION.put).not.toHaveBeenCalled()
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  // @lat: [[auth#CAPTCHA tests#Provider failures]]
  it.each(attempts)("does not continue $name when the provider is unavailable", async ({ run }) => {
    fetchMock.mockRejectedValue(new Error("Provider unavailable"))
    await expect(run("token")).rejects.toThrow("Provider unavailable")
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  // @lat: [[auth#CAPTCHA tests#Successful reset email challenge]]
  it("continues password reset email delivery with a valid challenge", async () => {
    mockDb.setMockSingleValue({ id: "test-user", email: signupData.email, firstName: "Test" })
    await expect(forgotPasswordFn({ data: { email: signupData.email, captchaToken: "token" } })).resolves.toEqual({ success: true })
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1)
    expect(runtime.KV_SESSION.put).toHaveBeenCalledTimes(1)
  })

  // @lat: [[auth#CAPTCHA tests#Successful signup challenge]]
  it("continues signup account creation with a valid challenge", async () => {
    mockDb.query.userTable.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "test-user", email: signupData.email, firstName: "Test",
    })
    await expect(signUpFn({ data: { ...signupData, captchaToken: "token" } })).resolves.toMatchObject({ success: true })
    expect(mockDb.insert).toHaveBeenCalledTimes(3)
    expect(auth.createAndStoreSession).toHaveBeenCalledTimes(1)
  })
})
