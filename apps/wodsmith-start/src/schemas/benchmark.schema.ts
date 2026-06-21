import { z } from "zod"

export const benchmarkKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores")

export const benchmarkCategorySchema = z
  .object({
    key: benchmarkKeySchema,
    label: z.string().min(1).max(80),
    testCount: z.number().int().nonnegative(),
    weight: z.number().positive().default(1),
  })
  .strict()

export const benchmarkCategoriesSchema = z
  .array(benchmarkCategorySchema)
  .min(1)
  .superRefine((categories, ctx) => {
    const seen = new Set<string>()

    for (const [index, category] of categories.entries()) {
      if (seen.has(category.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate benchmark category key: ${category.key}`,
          path: [index, "key"],
        })
      }
      seen.add(category.key)
    }
  })

export const benchmarkRatingBandSchema = z
  .object({
    key: benchmarkKeySchema,
    label: z.string().min(1).max(80),
    minScore: z.number().min(0),
    maxScore: z.number().min(0),
  })
  .strict()
  .refine((band) => band.maxScore >= band.minScore, {
    message: "maxScore must be greater than or equal to minScore",
    path: ["maxScore"],
  })

export const benchmarkRatingBandsSchema = z
  .array(benchmarkRatingBandSchema)
  .min(1)

export const benchmarkVideoPolicySchema = z.enum([
  "never",
  "for_top_scores",
  "always",
])

export const benchmarkThresholdValuesSchema = z.array(z.number().int()).length(10)

export const benchmarkVariantSchema = z.enum(["male", "female"])

export interface BenchmarkCategoryCountTest {
  categoryKey: string
  includedInScoring: boolean
}

export function getBenchmarkCategoryCountIssues(
  categories: ReadonlyArray<BenchmarkCategory>,
  tests: Iterable<BenchmarkCategoryCountTest>,
): string[] {
  const actualCounts = new Map<string, number>()

  for (const test of tests) {
    if (!test.includedInScoring) continue
    actualCounts.set(
      test.categoryKey,
      (actualCounts.get(test.categoryKey) ?? 0) + 1,
    )
  }

  const categoryKeys = new Set(categories.map((category) => category.key))
  const issues: string[] = []

  for (const category of categories) {
    const actualCount = actualCounts.get(category.key) ?? 0
    if (actualCount !== category.testCount) {
      issues.push(
        `Category ${category.key} declares testCount ${category.testCount} but has ${actualCount} included tests`,
      )
    }
  }

  for (const categoryKey of actualCounts.keys()) {
    if (!categoryKeys.has(categoryKey)) {
      issues.push(`Included test references unknown category ${categoryKey}`)
    }
  }

  return issues
}

export type BenchmarkCategory = z.infer<typeof benchmarkCategorySchema>
export type BenchmarkRatingBand = z.infer<typeof benchmarkRatingBandSchema>
export type BenchmarkVideoPolicy = z.infer<typeof benchmarkVideoPolicySchema>
export type BenchmarkVariant = z.infer<typeof benchmarkVariantSchema>
