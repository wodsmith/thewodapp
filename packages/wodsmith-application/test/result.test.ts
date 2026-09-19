import { describe, expect, it } from "vitest"

import { err, isErr, isOk, ok } from "../src/core/result"
import type { OperationReceipt } from "../src/core/receipt"
import type { ApplicationLogger } from "../src/core/services"

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

describe("operation receipts", () => {
  // @lat: [[tests/shared-application-guardrails#Fixed-Shape Receipt Logging]]
  it("logs receipts with fixed-shape aggregate identifiers", async () => {
    interface ScoreAggregateIds {
      readonly scoreId: string
      readonly divisionId: string | null
    }

    const receipt: OperationReceipt<"scores.delete", ScoreAggregateIds> = {
      operation: "scores.delete",
      aggregateIds: { scoreId: "score-1", divisionId: null },
      outcome: "accepted",
      implementationVersion: "1",
    }
    const recorded: unknown[] = []
    const logger: ApplicationLogger = {
      record(value) {
        recorded.push(value)
      },
    }

    await logger.record(receipt)

    expect(recorded).toEqual([receipt])
  })

  // @lat: [[tests/shared-application-guardrails#Fixed-Shape Operation Receipt Identifiers]]
  it("accepts fixed-shape aggregate identifiers", () => {
    interface ScoreAggregateIds {
      readonly scoreId: string
      readonly divisionId: string | null
    }

    const receipt: OperationReceipt<"scores.delete", ScoreAggregateIds> = {
      operation: "scores.delete",
      aggregateIds: { scoreId: "score-1", divisionId: null },
      outcome: "accepted",
      implementationVersion: "1",
    }

    expect(receipt.aggregateIds.scoreId).toBe("score-1")
  })
})
