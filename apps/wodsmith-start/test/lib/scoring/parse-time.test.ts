import { describe, expect, it } from "vitest"
import { encodeScore, parseScore } from "@/lib/scoring"

describe("parseScore time — preview matches save", () => {
  it("treats bare 4-digit input as raw seconds, not MM:SS", () => {
    const previewed = parseScore("2000", "time")
    expect(previewed.isValid).toBe(true)
    expect(previewed.encoded).toBe(2_000_000)
    expect(previewed.formatted).toBe("33:20")
    expect(previewed.encoded).toBe(encodeScore("2000", "time"))
  })

  it("treats bare 3-digit input as raw seconds", () => {
    const previewed = parseScore("345", "time")
    expect(previewed.isValid).toBe(true)
    expect(previewed.encoded).toBe(345_000)
    expect(previewed.encoded).toBe(encodeScore("345", "time"))
  })

  it("preserves 1-2 digit inputs (still raw seconds)", () => {
    expect(parseScore("45", "time").encoded).toBe(45_000)
    expect(parseScore("45", "time").formatted).toBe("0:45")
    expect(parseScore("45", "time").encoded).toBe(encodeScore("45", "time"))
  })

  it("still parses colon-delimited input correctly", () => {
    const result = parseScore("12:34", "time")
    expect(result.isValid).toBe(true)
    expect(result.encoded).toBe(754_000)
    expect(result.formatted).toBe("12:34")
    expect(result.encoded).toBe(encodeScore("12:34", "time"))
  })

  it("still parses colon + ms input correctly", () => {
    const result = parseScore("12:34.567", "time")
    expect(result.isValid).toBe(true)
    expect(result.encoded).toBe(754_567)
    expect(result.encoded).toBe(encodeScore("12:34.567", "time"))
  })

  it("treats single-period input as decimal seconds (preview matches save)", () => {
    const previewed = parseScore("1234.567", "time")
    expect(previewed.isValid).toBe(true)
    expect(previewed.encoded).toBe(1_234_567)
    expect(previewed.encoded).toBe(encodeScore("1234.567", "time"))
  })

  it("still parses period-delimited time (3+ parts) correctly", () => {
    const result = parseScore("12.34.567", "time")
    expect(result.isValid).toBe(true)
    expect(result.encoded).toBe(754_567)
    expect(result.encoded).toBe(encodeScore("12.34.567", "time"))
  })
})
