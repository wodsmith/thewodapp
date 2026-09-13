import { describe, expect, it } from "vitest"
import { buildAdminTrainingDays } from "../../scripts/seed/data/admin-training"
import { trainingContentSchema, trainingDateSchema } from "@/server/training-validation"

describe("admin demo training calendar", () => {
  it("provides two months of valid published workout and rest days across month boundaries", () => {
    const days = buildAdminTrainingDays("2026-09-12")
    expect(days).toHaveLength(61)
    expect(days.at(-1)?.date).toBe("2026-11-11")
    expect(new Set(days.map((day) => day.date)).size).toBe(61)
    const schemes = new Set<string>()
    for (const day of days) {
      expect(trainingDateSchema.safeParse(day.date).success).toBe(true)
      expect(trainingContentSchema.safeParse(day.content).success).toBe(true)
      if (day.content.isRestDay) expect(day.content.blocks).toEqual([])
      else {
        expect(day.content.blocks).toHaveLength(3)
        expect(day.content.blocks[1].workout).toBeDefined()
        schemes.add(day.content.blocks[1].workout!.scheme)
      }
    }
    expect(schemes).toEqual(new Set(["time", "load", "rounds-reps", "calories", "meters"]))
  })

  // @lat: [[training-seed#Supported date ranges]]
  it("rejects invalid ranges before seeding", () => {
    expect(() => buildAdminTrainingDays("2026-02-30")).toThrow("valid start date")
    expect(() => buildAdminTrainingDays("2026-09-12", 0)).toThrow("93 days")
    expect(() => buildAdminTrainingDays("2026-09-12", 94)).toThrow("93 days")
    expect(() => buildAdminTrainingDays("1999-12-31", 1)).toThrow("2000–2100")
    expect(() => buildAdminTrainingDays("2100-12-31", 2)).toThrow("2000–2100")
    expect(() => buildAdminTrainingDays("2101-01-01", 1)).toThrow("2000–2100")
    expect(buildAdminTrainingDays("2000-01-01", 1)[0].date).toBe("2000-01-01")
    expect(buildAdminTrainingDays("2100-12-31", 1)[0].date).toBe("2100-12-31")
  })
})
