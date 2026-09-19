// @lat: [[crew#Event Locations]]
import { afterEach, describe, expect, it, vi } from "vitest"

interface ServerFnCall {
  method?: string
  inputValidator?: (data: unknown) => unknown
  handler?: (options: unknown) => unknown
}

const { getDbMock, requireAccessMock, serverFnCalls } = vi.hoisted(() => ({
  serverFnCalls: [] as ServerFnCall[],
  getDbMock: vi.fn(),
  requireAccessMock: vi.fn().mockResolvedValue({ userId: "user_1" }),
}))

vi.mock("@/db", () => ({ getDb: getDbMock }))
vi.mock("@/server/crew-auth.server", () => ({
  requireCrewEventManagerAccess: requireAccessMock,
}))
vi.mock("@/lib/logging", () => ({
  addRequestContextAttribute: vi.fn(),
  logEntityCreated: vi.fn(),
  logEntityDeleted: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: (options: { method?: string } = {}) => {
    const call: ServerFnCall = { method: options.method }
    serverFnCalls.push(call)

    const builder = {
      inputValidator(inputValidator: ServerFnCall["inputValidator"]) {
        call.inputValidator = inputValidator
        return builder
      },
      handler(handler: ServerFnCall["handler"]) {
        call.handler = handler
        return async () => undefined
      },
    }

    return builder
  },
}))

async function importLocationServerFns() {
  serverFnCalls.length = 0
  return import("./crew-locations-fns")
}

/**
 * Find the create-location input validator: it is the only validator that
 * accepts a name + laneCount but rejects a `locationId` field-free probe with
 * a default lane count, and rejects a lane count below 1.
 */
function findCreateInputValidator() {
  const valid = { eventId: "comp_1", name: "Main Floor", laneCount: 6 }

  for (const call of serverFnCalls) {
    if (!call.inputValidator) continue

    // Update + delete validators require a locationId; create must accept
    // input without one.
    try {
      const parsed = call.inputValidator(valid) as {
        name?: string
        laneCount?: number
        locationId?: string
      }
      if (parsed.locationId !== undefined) continue
      if (parsed.name === "Main Floor" && parsed.laneCount === 6) {
        // Confirm it applies the default lane count.
        const defaulted = call.inputValidator({
          eventId: "comp_1",
          name: "Outside Rig",
        }) as { laneCount?: number }
        if (defaulted.laneCount === 3) return call.inputValidator
      }
    } catch {
      // Not the create validator.
    }
  }

  throw new Error("Create location input validator was not registered")
}

function findCreateServerFnCall() {
  const validator = findCreateInputValidator()
  const call = serverFnCalls.find(
    (candidate) => candidate.inputValidator === validator,
  )
  if (!call?.handler)
    throw new Error("Create location handler was not registered")
  return call
}

function createLocationDbMock(existingLocations: Array<{ id: string }>) {
  const event = {
    id: "comp_1",
    organizingTeamId: "team_1",
    competitionTeamId: null,
  }
  const selectResults: unknown[][] = [[event], existingLocations]
  const insertedValues = vi.fn().mockResolvedValue(undefined)
  let selectIndex = 0

  const db = {
    select: vi.fn(() => {
      const result = selectResults[selectIndex++] ?? []
      const query: Record<string, unknown> = {}
      query.from = vi.fn(() => query)
      query.innerJoin = vi.fn(() => query)
      query.where = vi.fn(() => query)
      query.limit = vi.fn(() => Promise.resolve(result))
      // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are intentionally promise-like.
      query.then = (
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject)
      return query
    }),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        insert: vi.fn(() => ({ values: insertedValues })),
      }),
    ),
  }

  return { db, insertedValues }
}

describe("Crew location server functions", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    serverFnCalls.length = 0
  })

  it("evaluates the server-fn module without throwing", async () => {
    await expect(importLocationServerFns()).resolves.toMatchObject({
      createCrewLocationFn: expect.any(Function),
      updateCrewLocationFn: expect.any(Function),
      deleteCrewLocationFn: expect.any(Function),
      getCrewLocationsFn: expect.any(Function),
      setDefaultCrewLocationFn: expect.any(Function),
    })
  })

  it("defaults lane count to 3 when omitted on create", async () => {
    await importLocationServerFns()
    const createValidator = findCreateInputValidator()

    expect(
      createValidator({ eventId: "comp_1", name: "Outside Rig" }),
    ).toMatchObject({
      name: "Outside Rig",
      laneCount: 3,
      transitionMinutes: 2,
    })
  })

  it("accepts a per-location default heat gap", async () => {
    await importLocationServerFns()
    const createValidator = findCreateInputValidator()

    expect(
      createValidator({
        eventId: "comp_1",
        name: "Outside Rig",
        transitionMinutes: 5,
      }),
    ).toMatchObject({ transitionMinutes: 5 })
  })

  it("rejects a heat gap outside the supported range", async () => {
    await importLocationServerFns()
    const createValidator = findCreateInputValidator()

    expect(() =>
      createValidator({
        eventId: "comp_1",
        name: "Outside Rig",
        transitionMinutes: 121,
      }),
    ).toThrow()
  })

  it("rejects a lane count below the minimum on create", async () => {
    await importLocationServerFns()
    const createValidator = findCreateInputValidator()

    expect(() =>
      createValidator({ eventId: "comp_1", name: "Main Floor", laneCount: 0 }),
    ).toThrow()
  })

  it("rejects an empty location name on create", async () => {
    await importLocationServerFns()
    const createValidator = findCreateInputValidator()

    expect(() =>
      createValidator({ eventId: "comp_1", name: "   ", laneCount: 4 }),
    ).toThrow()
  })

  it("marks the first created location as the event default", async () => {
    await importLocationServerFns()
    const createCall = findCreateServerFnCall()
    const { db, insertedValues } = createLocationDbMock([])
    getDbMock.mockReturnValue(db)

    const data = createCall.inputValidator?.({
      eventId: "comp_1",
      name: "Main Floor",
      laneCount: 6,
      transitionMinutes: 3,
    })
    await createCall.handler?.({ data })

    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: "comp_1",
        isDefault: true,
        transitionMinutes: 3,
      }),
    )
  })

  it("leaves later locations non-default", async () => {
    await importLocationServerFns()
    const createCall = findCreateServerFnCall()
    const { db, insertedValues } = createLocationDbMock([{ id: "venue_1" }])
    getDbMock.mockReturnValue(db)

    const data = createCall.inputValidator?.({
      eventId: "comp_1",
      name: "Outside Rig",
      laneCount: 4,
      transitionMinutes: 5,
    })
    await createCall.handler?.({ data })

    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: false }),
    )
  })
})
