import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  session: vi.fn(),
  owned: vi.fn(),
  create: vi.fn(),
  allocate: vi.fn(),
  budget: vi.fn(),
  initialize: vi.fn(),
  snapshot: vi.fn(),
  cancel: vi.fn(),
  fetch: vi.fn(),
  image: vi.fn(),
  store: vi.fn(),
}))
vi.mock("agents", () => ({ getAgentByName: m.allocate }))
vi.mock("@/agents/workout-import-agent", () => ({
  WorkoutImportAgent: class {},
  chargeWorkoutImportBudget: m.budget,
}))
vi.mock("@/utils/auth", () => ({ getSessionFromRequestCookie: m.auth }))
vi.mock("./access", () => ({
  requireWorkoutImportAccess: m.access,
  WorkoutImportAccessError: class extends Error {},
}))
vi.mock("./sessions", () => ({
  requireWorkoutImportSession: m.session,
  loadOwnedWorkoutImportSession: m.owned,
  createWorkoutImportSession: m.create,
}))
vi.mock("./source", () => ({
  normalizeImportImage: m.image,
  sourceKey: (id: string) => `sources/${id}/image`,
}))

import { handleWorkoutImportRequest } from "./http"
import { WorkoutImportSessionExpiredError } from "./session-errors"

const session = {
  importId: "wimp_one",
  userId: "user",
  teamId: "personal",
  destination: { kind: "personal" },
  revision: 0,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}
const request = (path: string, method = "GET", body?: unknown) =>
  new Request(`https://app.test${path}`, {
    method,
    headers: { origin: "https://app.test", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
const env = {
  WORKOUT_IMPORT_AGENT: {},
  WORKOUT_IMPORT_SOURCES: { get: vi.fn() },
  WORKOUT_IMPORT_IMAGES: {},
} as unknown as Env
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ userId: "user" })
  m.access.mockResolvedValue(session)
  m.session.mockResolvedValue(session)
  m.owned.mockResolvedValue(session)
  m.create.mockResolvedValue(session)
  m.allocate.mockResolvedValue({
    initialize: m.initialize,
    snapshot: m.snapshot,
    cancelOwned: m.cancel,
    fetch: m.fetch,
    storeSource: m.store,
  })
  m.snapshot.mockResolvedValue({ status: "idle", draft: null })
  m.cancel.mockResolvedValue({ cancelled: true })
})

describe("authenticated import HTTP routing (mock services)", () => {
  // @lat: [[workout-import-runtime#Cancel method restriction]]
  it("rejects GET cancel before loading sessions or allocating agents", async () => {
    const response = await handleWorkoutImportRequest(
      request("/api/workout-import/sessions/wimp_one/cancel"),
      env,
    )
    expect(response?.status).toBe(405)
    expect(response?.headers.get("allow")).toBe("POST")
    expect(m.session).not.toHaveBeenCalled()
    expect(m.owned).not.toHaveBeenCalled()
    expect(m.allocate).not.toHaveBeenCalled()
  })
  // @lat: [[workout-import-runtime#Expired session HTTP recovery]]
  it("returns source_expired for an authorized expired session before allocating or reading private data", async () => {
    m.session.mockRejectedValue(new WorkoutImportSessionExpiredError())
    for (const path of [
      "/api/workout-import/sessions/wimp_one",
      "/api/workout-import/sessions/wimp_one/source",
      "/agents/workout-import-agent/wimp_one",
    ]) {
      const response = await handleWorkoutImportRequest(request(path), env)
      expect(response?.status).toBe(410)
      expect(await response?.json()).toEqual({
        error: { code: "source_expired" },
      })
      expect(response?.headers.get("cache-control")).toBe("private, no-store")
    }
    expect(m.allocate).not.toHaveBeenCalled()
    expect(env.WORKOUT_IMPORT_SOURCES.get).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-runtime#HTTP failure diagnostics]]
  it("distinguishes infrastructure failure without exposing raw errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    m.budget.mockRejectedValueOnce(new Error("private provider credentials"))
    try {
      const response = await handleWorkoutImportRequest(
        request("/api/workout-import/sessions", "POST", {
          destination: { kind: "personal" },
        }),
        env,
      )
      expect(response?.status).toBe(500)
      expect(await response?.json()).toEqual({
        error: { code: "provider_error" },
      })
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "workout-import-request-failed",
        {
          stage: "budget",
          code: "provider_error",
        },
      )
      expect(m.create).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  // @lat: [[workout-import-runtime#HTTP authorization]]
  it("checks access before allocating a session/agent or charging model work", async () => {
    m.access.mockRejectedValue(
      new Error("wrong team or unavailable grant lookup"),
    )
    const response = await handleWorkoutImportRequest(
      request("/api/workout-import/sessions", "POST", {
        destination: { kind: "personal" },
      }),
      env,
    )
    expect(response?.status).toBe(403)
    expect(m.create).not.toHaveBeenCalled()
    expect(m.allocate).not.toHaveBeenCalled()
    expect(m.budget).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-runtime#Origin and namespace isolation]]
  it("rejects cross-origin mutation/socket and arbitrary subpaths before allocation", async () => {
    for (const req of [
      new Request("https://app.test/api/workout-import/sessions", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
      new Request("https://app.test/agents/workout-import-agent/wimp_one", {
        headers: { upgrade: "websocket", origin: "https://evil.test" },
      }),
    ])
      expect((await handleWorkoutImportRequest(req, env))?.status).toBe(403)
    expect(
      (
        await handleWorkoutImportRequest(
          request("/agents/workout-import-agent/wimp_one/sub-agent"),
          env,
        )
      )?.status,
    ).toBe(404)
    expect(m.allocate).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-runtime#Private source delivery]]
  it("rechecks current access after loading source and sends no bytes after revocation", async () => {
    vi.mocked(env.WORKOUT_IMPORT_SOURCES.get).mockImplementation(async () => {
      m.session.mockRejectedValue(new Error("revoked"))
      return {
        body: new Blob(["private image"]).stream(),
        customMetadata: { expiresAt: String(Date.now() + 10000) },
      } as never
    })
    const response = await handleWorkoutImportRequest(
      request("/api/workout-import/sessions/wimp_one/source"),
      env,
    )
    expect(response?.status).toBe(403)
    expect(await response?.text()).not.toContain("private image")
    expect(response?.headers.get("cache-control")).toBe("private, no-store")
  })

  // @lat: [[workout-import-runtime#HTTP cancellation]]
  it("offers ownership-only HTTP cancellation after a revoked socket closes", async () => {
    m.session.mockRejectedValue(new Error("revoked"))
    const response = await handleWorkoutImportRequest(
      request("/api/workout-import/sessions/wimp_one/cancel", "POST"),
      env,
    )
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({ cancelled: true })
    expect(m.owned).toHaveBeenCalledWith({
      userId: "user",
      importId: "wimp_one",
    })
    expect(m.session).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-runtime#Unknown session isolation]]
  it("cannot allocate or read another actor's guessed session", async () => {
    m.session.mockRejectedValue(new Error("not owned"))
    const response = await handleWorkoutImportRequest(
      request("/api/workout-import/sessions/wimp_other"),
      env,
    )
    expect(response?.status).toBe(403)
    expect(m.allocate).not.toHaveBeenCalled()
    expect(
      await handleWorkoutImportRequest(
        request("/agents/judge-scheduler-agent/event__user"),
        env,
      ),
    ).toBeNull()
  })
})
