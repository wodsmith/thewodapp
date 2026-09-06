import type { Connection, FiberRecoveryContext } from "agents"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WorkoutImportSessionExpiredError } from "@/server/workout-import/session-errors"

const m = vi.hoisted(() => ({
  access: vi.fn(),
  cleanup: vi.fn(),
  publish: vi.fn(),
  infer: vi.fn(),
  auth: vi.fn(),
  connection: null as unknown,
  sockets: [] as unknown[],
  budget: vi.fn(),
  allocate: vi.fn(),
}))
vi.mock("@/server/workout-import/sessions", () => ({
  requireWorkoutImportSession: m.access,
  loadOwnedWorkoutImportSession: m.access,
  cleanupWorkoutImportSession: m.cleanup,
  publishWorkoutImportRevision: m.publish,
}))
vi.mock("@/server/workout-import/inference", () => ({
  inferWorkoutImport: m.infer,
  WORKOUT_IMPORT_MODEL: "test-model",
}))
vi.mock("@/utils/auth", () => ({ getSessionFromRequestCookie: m.auth }))
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ limit: async () => [] }) }),
  }),
}))
vi.mock("evlog/workers", () => ({
  createWorkersLogger: () => ({ set: vi.fn(), emit: vi.fn() }),
}))
vi.mock("agents", () => ({
  Agent: class {
    ctx: unknown
    env: unknown
    saved: unknown
    initialState: unknown
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx
      this.env = env
    }
    get state() {
      return this.saved ?? this.initialState
    }
    setState(state: unknown) {
      this.saved = state
    }
    getConnections() {
      return m.sockets.values()
    }
    async schedule() {
      return null
    }
    async runFiber(_name: string, fn: () => Promise<unknown>) {
      return fn()
    }
  },
  callable: () => (method: unknown) => method,
  getCurrentAgent: () => ({ connection: m.connection }),
  getAgentByName: m.allocate,
}))

import { IMPORT_LIMITS } from "@/server/workout-import/limits"
import {
  chargeWorkoutImportBudget,
  WorkoutImportAgent,
} from "./workout-import-agent"

const session = {
  importId: "wimp_test",
  userId: "user",
  teamId: "personal",
  destination: { kind: "personal" },
  revision: 0,
  proposal: null,
  draft: null,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}
const input = {
  importId: session.importId,
  requestId: "request-one",
  expectedRevision: 0,
  source: { text: "3 rounds for time" },
}

async function setup() {
  const values = new Map<string, unknown>()
  const storage = {
    get: async (key: string) => values.get(key),
    put: async (key: string, value: unknown) => {
      values.set(key, value)
    },
    delete: vi.fn(async (key: string) => values.delete(key)),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(storage),
  }
  const bucket = { delete: vi.fn(), put: vi.fn() }
  const agent = new WorkoutImportAgent(
    { storage } as unknown as DurableObjectState,
    {
      WORKOUT_IMPORT_SOURCES: bucket,
      WORKOUT_IMPORT_AGENT: {},
      AI: {},
      WORKOUT_IMPORT_GATEWAY: "test",
    } as unknown as Env,
  )
  const socket = {
    state: { userId: "user", cookie: "session=test" },
    send: vi.fn(),
    close: vi.fn(),
    setState: vi.fn(),
  }
  m.connection = socket
  m.sockets = [socket]
  await agent.initialize(session)
  return { agent, socket, bucket, values }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.access.mockResolvedValue(session)
  m.auth.mockResolvedValue({ userId: "user" })
  m.cleanup.mockResolvedValue(undefined)
  m.budget.mockResolvedValue(undefined)
  m.allocate.mockResolvedValue({ chargeBudget: m.budget })
})

describe("WorkoutImportAgent with mocked session services", () => {
  // @lat: [[workout-import-runtime#Denied upload cleanup]]
  it("deletes an uploaded source if access is revoked during the put", async () => {
    const { agent, bucket } = await setup()
    bucket.put.mockImplementation(async () => {
      m.access.mockRejectedValue(new Error("revoked"))
    })
    await expect(
      agent.storeSource("user", new Uint8Array([1])),
    ).rejects.toThrow("access_required")
    expect(bucket.delete).toHaveBeenCalledWith("sources/wimp_test/image")
  })

  // @lat: [[workout-import-runtime#Cleanup failure preserves denial]]
  it("preserves typed expiry when best-effort source deletion fails", async () => {
    const { agent, bucket } = await setup()
    bucket.put.mockImplementation(async () => {
      m.access.mockRejectedValue(new WorkoutImportSessionExpiredError())
    })
    bucket.delete.mockRejectedValue(new Error("R2 unavailable"))
    await expect(
      agent.storeSource("user", new Uint8Array([1])),
    ).rejects.toMatchObject({
      code: "source_expired",
      status: 410,
    })
    expect(bucket.delete).toHaveBeenCalledWith("sources/wimp_test/image")
  })

  // @lat: [[workout-import-runtime#Budget wiring]]
  it("charges actor and destination team with the correct dispatch and session limits", async () => {
    const ns = {}
    const env = { WORKOUT_IMPORT_AGENT: ns } as unknown as Env
    await chargeWorkoutImportBudget(env, "actor", "destination", "session")
    expect(m.allocate.mock.calls).toEqual([
      [ns, "budget-actor-actor"],
      [ns, "budget-team-destination"],
    ])
    expect(m.budget.mock.calls).toEqual([
      ["session", IMPORT_LIMITS.actorDailySessions],
      ["session", IMPORT_LIMITS.teamDailySessions],
    ])
    m.budget.mockClear()
    m.budget
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("team exhausted"))
    await expect(
      chargeWorkoutImportBudget(env, "actor", "destination", "dispatch"),
    ).rejects.toThrow("team exhausted")
    expect(m.budget.mock.calls).toEqual([
      ["dispatch", IMPORT_LIMITS.actorDailyDispatches],
      ["dispatch", IMPORT_LIMITS.teamDailyDispatches],
    ])
  })
  // @lat: [[workout-import-runtime#Agent authorization]]
  it("denies RPC and generic client state updates without dispatching inference", async () => {
    const { agent, socket } = await setup()
    m.access.mockRejectedValue(new Error("revoked"))
    await expect(agent.readWorkout(input)).rejects.toThrow("access_required")
    expect(m.infer).not.toHaveBeenCalled()
    expect(agent.shouldSendProtocolMessages()).toBe(false)
    expect(() =>
      agent.validateStateChange(
        { ...agent.state, status: "ready" },
        socket as unknown as Connection,
      ),
    ).toThrow("server-owned")
  })

  // @lat: [[workout-import-runtime#Revoked socket delivery]]
  it("rejects an already-open socket snapshot and never sends stored draft after revocation", async () => {
    const { agent, socket } = await setup()
    m.access.mockRejectedValue(new Error("revoked"))
    await expect(agent.getSnapshot()).rejects.toThrow("access_required")
    await agent.onConnect(socket as unknown as Connection, {
      request: new Request("https://app/agents/workout-import-agent/wimp_test"),
    })
    expect(socket.send).not.toHaveBeenCalled()
    expect(socket.close).toHaveBeenCalledWith(4403, "access_required")
    await expect(agent.snapshot("different-user")).rejects.toThrow(
      "access_required",
    )
  })

  // @lat: [[workout-import-runtime#Terminal cancellation]]
  it("allows cleanup after revocation and discards an in-flight late result", async () => {
    let finish!: (value: unknown) => void
    m.infer.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { agent, bucket } = await setup()
    await agent.readWorkout(input)
    await vi.waitFor(() => expect(m.infer).toHaveBeenCalledTimes(1))
    await expect(
      agent.readWorkout({ ...input, requestId: "duplicate" }),
    ).rejects.toThrow("busy")
    m.access.mockRejectedValue(new Error("revoked"))
    await agent.cancel()
    finish({ workout: {}, unresolved: [] })
    await Promise.resolve()
    expect(agent.state.status).toBe("cancelled")
    expect(m.publish).not.toHaveBeenCalled()
    expect(bucket.delete).toHaveBeenCalledWith("sources/wimp_test/image")
    expect(m.cleanup).toHaveBeenCalledWith({
      userId: "user",
      importId: "wimp_test",
    })
  })

  // @lat: [[workout-import-runtime#Recovery authorization]]
  it("does not replay an orphaned model job after permission expiry", async () => {
    const { agent, bucket } = await setup()
    m.access.mockRejectedValue(new Error("expired"))
    await agent.onFiberRecovered({
      name: "workout-import",
    } as FiberRecoveryContext)
    expect(m.infer).not.toHaveBeenCalled()
    expect(bucket.delete).toHaveBeenCalled()
  })

  // @lat: [[workout-import-runtime#Durable budget]]
  it("enforces a persistent budget across repeated calls", async () => {
    const { agent } = await setup()
    await agent.chargeBudget("dispatch", 2)
    await agent.chargeBudget("dispatch", 2)
    await expect(agent.chargeBudget("dispatch", 2)).rejects.toThrow(
      "rate_limited",
    )
  })

  // @lat: [[workout-import-runtime#Expired connection recovery]]
  it("preserves source expiry for snapshots and closes owned expired connections without claiming revocation", async () => {
    const { agent, socket } = await setup()
    m.access.mockRejectedValue(new WorkoutImportSessionExpiredError())
    await expect(agent.snapshot("user")).rejects.toMatchObject({
      code: "source_expired",
      status: 410,
    })
    await agent.onConnect(
      socket as unknown as Connection,
      {
        request: new Request("https://app.test", {
          headers: { cookie: "session=test" },
        }),
      } as never,
    )
    expect(socket.close).toHaveBeenCalledWith(4403, "source_expired")
    expect(socket.send).not.toHaveBeenCalled()
    m.auth.mockResolvedValue({ userId: "other" })
    await agent.onConnect(
      socket as unknown as Connection,
      { request: new Request("https://app.test") } as never,
    )
    expect(socket.close).toHaveBeenLastCalledWith(4403, "access_required")
  })

  // @lat: [[workout-import-runtime#Saved source cleanup]]
  it("purges source/job/draft after save without expiring the DB retry receipt", async () => {
    const { agent, bucket, values } = await setup()
    values.set("job", input)
    m.access.mockResolvedValue({ ...session, revision: 1, draft: null })
    await agent.purgeSaved("user")
    expect(bucket.delete).toHaveBeenCalledWith("sources/wimp_test/image")
    expect(values.has("job")).toBe(false)
    expect(agent.state.draft).toBeNull()
    expect(m.cleanup).not.toHaveBeenCalled()
  })
})
