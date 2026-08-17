export interface BenchmarkCategoryDefinition {
  key: string
  label?: string
  testCount: number
  weight?: number
}

export interface BenchmarkEventTier {
  eventId: string
  categoryKey: string
  tier: number
  includedInScoring?: boolean
}

export interface BenchmarkCategoryScore {
  key: string
  label?: string
  score: number
  tierSum: number
  testCount: number
  weight: number
}

export interface BenchmarkAggregationInput {
  categories: readonly BenchmarkCategoryDefinition[]
  eventTiers: readonly BenchmarkEventTier[]
  maxTier: number
  scoreMax: number
}

export interface BenchmarkAggregationResult {
  categories: BenchmarkCategoryScore[]
  overallScore: number
}

export function aggregateBenchmarkScores(
  input: BenchmarkAggregationInput,
): BenchmarkAggregationResult {
  const tiersByCategory = new Map<string, BenchmarkEventTier[]>()

  for (const tier of input.eventTiers) {
    if (tier.includedInScoring === false) {
      continue
    }
    const existing = tiersByCategory.get(tier.categoryKey) ?? []
    existing.push(tier)
    tiersByCategory.set(tier.categoryKey, existing)
  }

  const categories = input.categories.map((category) => {
    const tiers = tiersByCategory.get(category.key) ?? []
    const tierSum = tiers.reduce((sum, tier) => sum + tier.tier, 0)
    const weight = category.weight ?? 1
    const denominator = category.testCount * input.maxTier
    const score = denominator > 0 ? (tierSum / denominator) * input.scoreMax : 0

    return {
      key: category.key,
      label: category.label,
      score,
      tierSum,
      testCount: category.testCount,
      weight,
    }
  })

  const totalWeight = categories.reduce(
    (sum, category) => sum + category.weight,
    0,
  )
  const overallScore =
    totalWeight > 0
      ? categories.reduce(
          (sum, category) => sum + category.score * category.weight,
          0,
        ) / totalWeight
      : 0

  return {
    categories,
    overallScore,
  }
}
