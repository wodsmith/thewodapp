// @lat: [[crew#Event Locations]]
import { afterEach, describe, expect, it, vi } from "vitest"

interface ServerFnCall {
  method?: string
  inputValidator?: (data: unknown) => unknown
  handler?: (options: unknown) => unknown
}

const { serverFnCalls } = vi.hoisted(() => ({
  serverFnCalls: [] as ServerFnCall[],
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

describe("Crew location server functions", () => {
  afterEach(() => {
    vi.resetModules()
    serverFnCalls.length = 0
  })

  it("evaluates the server-fn module without throwing", async () => {
    await expect(importLocationServerFns()).resolves.toMatchObject({
      createCrewLocationFn: expect.any(Function),
      updateCrewLocationFn: expect.any(Function),
      deleteCrewLocationFn: expect.any(Function),
      getCrewLocationsFn: expect.any(Function),
    })
  })

  it("defaults lane count to 3 when omitted on create", async () => {
    await importLocationServerFns()
    const createValidator = findCreateInputValidator()

    expect(
      createValidator({ eventId: "comp_1", name: "Outside Rig" }),
    ).toMatchObject({ name: "Outside Rig", laneCount: 3 })
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
})
