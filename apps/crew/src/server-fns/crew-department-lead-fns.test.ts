// @lat: [[crew#Department Leads]]
import { afterEach, describe, expect, it, vi } from "vitest"

type ServerFnCall = {
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

const validUpdateInput = {
  eventId: "tw_event",
  leadId: "cdlead_123",
  email: "lead@example.com",
  name: null,
  membershipId: null,
  roleType: "judge",
  floor: null,
  startsAt: null,
  endsAt: null,
  notes: null,
}

async function importDepartmentLeadServerFns() {
  serverFnCalls.length = 0
  return import("./crew-department-lead-fns")
}

function findUpdateInputValidator() {
  const updateInputWithoutLeadId = {
    ...validUpdateInput,
    leadId: undefined,
  }

  for (const call of serverFnCalls) {
    if (!call.inputValidator) {
      continue
    }

    try {
      call.inputValidator(updateInputWithoutLeadId)
    } catch (error) {
      if (error instanceof Error && error.message.includes("leadId")) {
        return call.inputValidator
      }
    }
  }

  throw new Error("Update department lead input validator was not registered")
}

describe("Crew department lead server functions", () => {
  afterEach(() => {
    vi.resetModules()
    serverFnCalls.length = 0
  })

  it("evaluates the server-fn module without throwing", async () => {
    await expect(importDepartmentLeadServerFns()).resolves.toMatchObject({
      updateCrewDepartmentLeadFn: expect.any(Function),
    })
  })

  it("keeps the update input email or membershipId refinement", async () => {
    await importDepartmentLeadServerFns()

    const updateInputValidator = findUpdateInputValidator()

    expect(() =>
      updateInputValidator({
        ...validUpdateInput,
        email: null,
        membershipId: null,
      }),
    ).toThrow("Add an email or choose a volunteer.")
  })
})
