import { describe, expect, it } from "vitest"

import { err, isErr, isOk, ok } from "../src/core/result"

describe("Result", () => {
  it("narrows successful values", () => {
    const result = ok("recorded")

    expect(isOk(result)).toBe(true)
    expect(isErr(result)).toBe(false)
    expect(result).toEqual({ ok: true, value: "recorded" })
  })

  it("narrows expected errors", () => {
    const result = err({ kind: "forbidden" as const })

    expect(isErr(result)).toBe(true)
    expect(isOk(result)).toBe(false)
    expect(result).toEqual({ ok: false, error: { kind: "forbidden" } })
  })
})
