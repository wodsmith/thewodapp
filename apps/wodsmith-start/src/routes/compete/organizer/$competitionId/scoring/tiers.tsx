"use client"

import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertTriangle, CheckCircle2, Gauge, Loader2, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  type BenchmarkSettingsDraft,
  BenchmarkSettingsForm,
} from "@/components/benchmark-tiers/benchmark-settings-form"
import {
  CategoriesManager,
  type CategoryDraft,
  type CategorySummaryItem,
} from "@/components/benchmark-tiers/categories-manager"
import {
  type RatingBandDraft,
  RatingBandsEditor,
} from "@/components/benchmark-tiers/rating-bands-editor"
import {
  AddTestDialog,
  type CategoryOption,
  type EditableTest,
  EditTestDialog,
  type TestDraft,
} from "@/components/benchmark-tiers/test-editor-dialogs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { competitionCan } from "@/lib/competitions/capabilities"
import { benchmarkVariantSchema } from "@/schemas/benchmark.schema"
import type {
  BenchmarkScoringTierSummary,
  BenchmarkScoringTierTest,
} from "@/server/benchmark-scoring-tiers"
import {
  activateBenchmarkOnlineScoringFn,
  createBenchmarkTestFn,
  deleteBenchmarkTestFn,
  getBenchmarkScoringTiersFn,
  saveBenchmarkScoringTiersFn,
  updateBenchmarkBatterySettingsFn,
  updateBenchmarkCategoriesFn,
  updateBenchmarkRatingBandsFn,
  updateBenchmarkTestFn,
} from "@/server-fns/benchmark-scoring-tier-fns"

const VARIANTS: string[] = [...benchmarkVariantSchema.options]

// @lat: [[organizer-dashboard#Organizer Dashboard#Benchmark Tier Scoring]]
export const Route = createFileRoute(
  "/compete/organizer/$competitionId/scoring/tiers",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const loaderData = parentMatch.loaderData
    if (!loaderData) {
      throw notFound()
    }
    const { competition } = loaderData

    if (!competitionCan(competition.competitionType, "benchmarkScoringTiers")) {
      throw notFound()
    }

    const tierState = await getBenchmarkScoringTiersFn({
      data: { competitionId: params.competitionId },
    })

    return { competition, tierState }
  },
  component: BenchmarkScoringTiersPage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.competition
          ? `Benchmark scoring - ${loaderData.competition.name}`
          : "Benchmark scoring",
      },
    ],
  }),
})

function BenchmarkScoringTiersPage() {
  const { tierState } = Route.useLoaderData()
  if (tierState.status !== "ready") {
    return <BenchmarkScoringSetupRequired reason={tierState.reason} />
  }

  return <BenchmarkScoringTiersEditor initialSummary={tierState.summary} />
}

function BenchmarkScoringSetupRequired({ reason }: { reason: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            Benchmark Scoring
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Set up how athletes are scored: tests, tiers, categories, and ratings.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="flex gap-3 py-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-semibold">Benchmark setup required</h2>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HowScoringWorksCard({
  summary,
}: {
  summary: BenchmarkScoringTierSummary
}) {
  const { maxTier, scoreMax } = summary.battery
  const sortedBands = [...summary.ratingBands].sort(
    (a, b) => a.minScore - b.minScore,
  )
  const ratingList = sortedBands.map((band) => band.label).join(" → ")

  const steps = [
    {
      title: "Each test result earns a tier",
      body: `When an athlete logs a score, it's compared against the thresholds below and lands in a tier from 1 to ${maxTier}. Tier ${maxTier} is the hardest standard; a score below the tier 1 threshold still earns half a tier.`,
    },
    {
      title: "Tiers become category scores",
      body: `Each category averages the tiers of its tests and converts that to a score out of ${scoreMax}. Hitting tier ${maxTier} on every test in a category scores ${scoreMax}/${scoreMax}.`,
    },
    {
      title: "Categories combine into the overall score",
      body: `Category scores are averaged using the category weights you set below, giving an overall score out of ${scoreMax}${
        ratingList ? ` and a rating (${ratingList})` : ""
      }.`,
    },
  ]

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>How the score works</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function BenchmarkScoringTiersEditor({
  initialSummary,
}: {
  initialSummary: BenchmarkScoringTierSummary
}) {
  const [summary, setSummary] =
    useState<BenchmarkScoringTierSummary>(initialSummary)
  const [draft, setDraft] = useState(() => buildDraft(initialSummary))
  const [isSaving, setIsSaving] = useState(false)
  const [isSwitchingToOnline, setIsSwitchingToOnline] = useState(false)
  const saveTiers = useServerFn(saveBenchmarkScoringTiersFn)
  const activateOnlineScoring = useServerFn(activateBenchmarkOnlineScoringFn)
  const saveRatingBands = useServerFn(updateBenchmarkRatingBandsFn)
  const saveCategories = useServerFn(updateBenchmarkCategoriesFn)
  const createTest = useServerFn(createBenchmarkTestFn)
  const updateTest = useServerFn(updateBenchmarkTestFn)
  const removeTest = useServerFn(deleteBenchmarkTestFn)
  const saveBenchmarkSettings = useServerFn(updateBenchmarkBatterySettingsFn)
  const variants = summary.variants.length > 0 ? summary.variants : ["male"]
  const defaultVariant = variants[0] ?? "male"
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant)
  const activeVariant = variants.includes(selectedVariant)
    ? selectedVariant
    : defaultVariant

  const changedCount = useMemo(() => {
    const original = buildDraft(summary)
    return Object.entries(draft).filter(
      ([key, value]) => original[key] !== value,
    ).length
  }, [draft, summary])

  const handleRawValueChange = ({
    testId,
    variant,
    tier,
    rawValue,
  }: {
    testId: string
    variant: string
    tier: number
    rawValue: string
  }) => {
    setDraft((current) => ({
      ...current,
      [draftKey(testId, variant, tier)]: rawValue,
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const nextSummary = await saveTiers({
        data: {
          competitionId: summary.competitionId,
          thresholds: flattenThresholdUpdates(summary, draft),
        },
      })
      setSummary(nextSummary)
      setDraft(buildDraft(nextSummary))
      toast.success("Tier thresholds saved")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save benchmark tiers",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleActivateOnline = async () => {
    setIsSwitchingToOnline(true)
    try {
      const nextSummary = await activateOnlineScoring({
        data: { competitionId: summary.competitionId },
      })
      setSummary(nextSummary)
      setDraft(buildDraft(nextSummary))
      toast.success("Online scoring activated")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to activate online scoring",
      )
    } finally {
      setIsSwitchingToOnline(false)
    }
  }

  const applySummary = (next: BenchmarkScoringTierSummary) => {
    setSummary(next)
    setDraft(buildDraft(next))
  }

  const handleSaveRatingBands = async (bands: RatingBandDraft[]) => {
    const next = await saveRatingBands({
      data: { competitionId: summary.competitionId, ratingBands: bands },
    })
    applySummary(next)
    toast.success("Rating bands saved")
  }

  const handleSaveCategories = async (categories: CategoryDraft[]) => {
    const next = await saveCategories({
      data: {
        competitionId: summary.competitionId,
        categories: categories.map((category) => ({
          key: category.key,
          label: category.label,
          weight: category.weight,
        })),
      },
    })
    applySummary(next)
    toast.success("Categories saved")
  }

  const handleCreateTest = async (
    test: TestDraft,
    linkTrackWorkoutId: string | null,
  ) => {
    const { summary: next } = await createTest({
      data: { competitionId: summary.competitionId, test, linkTrackWorkoutId },
    })
    applySummary(next)
    toast.success("Event tiers created")
  }

  const handleUpdateTest = async (
    testId: string,
    updates: Partial<TestDraft>,
  ) => {
    const next = await updateTest({
      data: { competitionId: summary.competitionId, testId, updates },
    })
    applySummary(next)
    toast.success("Test updated")
  }

  const handleDeleteTest = async (testId: string) => {
    const next = await removeTest({
      data: { competitionId: summary.competitionId, testId },
    })
    applySummary(next)
    toast.success("Test deleted")
  }

  const handleSaveBenchmarkSettings = async (
    settings: BenchmarkSettingsDraft,
  ) => {
    const next = await saveBenchmarkSettings({
      data: { competitionId: summary.competitionId, settings },
    })
    applySummary(next)
    toast.success("Benchmark settings saved")
  }

  const categorySummaryItems: CategorySummaryItem[] = summary.categories.map(
    (category) => ({
      key: category.key,
      label: category.label,
      weight: category.weight,
      totalTestCount: category.totalTestCount,
    }),
  )
  const allCategoryOptions: CategoryOption[] = summary.categories.map(
    (category) => ({ key: category.key, label: category.label }),
  )

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              Benchmark Scoring
            </h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Set up how athletes are scored: tests, tiers, categories, and
            ratings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{summary.battery.maxTier} tiers</Badge>
          <Badge variant="outline">
            {summary.includedTestCount} scored tests
          </Badge>
        </div>
      </div>

      {summary.isActive ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <h2 className="font-semibold">
                  Leaderboard is ranking by tier score
                </h2>
                <p className="text-sm text-muted-foreground">
                  This competition still uses tier score as the ranking
                  algorithm. Benchmark leaderboards now rank athletes with
                  online scoring while tiers, category scores, and ratings
                  display alongside as context.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleActivateOnline}
              disabled={isSwitchingToOnline}
            >
              {isSwitchingToOnline ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Switch to online scoring
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex gap-3 py-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Tier context is live</h2>
              <p className="text-sm text-muted-foreground">
                The leaderboard ranks athletes with online scoring. These tier
                thresholds add context on top: each result shows its tier, and
                athletes get category scores and an overall rating on the
                leaderboard and stats pages.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <HowScoringWorksCard summary={summary} />

      <BenchmarkSettingsForm
        settings={summary.battery}
        onSave={handleSaveBenchmarkSettings}
      />

      <CategoriesManager
        categories={categorySummaryItems}
        onSave={handleSaveCategories}
      />

      <RatingBandsEditor
        bands={summary.ratingBands}
        scoreMax={summary.battery.scoreMax}
        onSave={handleSaveRatingBands}
      />

      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Tier thresholds
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            For each test, enter the minimum result an athlete needs to reach
            each tier — T1 is the easiest standard, T{summary.battery.maxTier}{" "}
            the hardest. Thresholds are set separately per variant.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="benchmark-scoring-variant"
              className="text-sm font-medium"
            >
              Variant
            </Label>
            <select
              id="benchmark-scoring-variant"
              value={activeVariant}
              onChange={(event) => setSelectedVariant(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {variants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </div>
          {changedCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {changedCount} unsaved threshold edit
              {changedCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {summary.categories.map((category) => (
          <Card key={category.key}>
            <CardHeader className="gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{category.label}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {category.includedTestCount}/{category.testCount} scored
                  </Badge>
                  <AddTestDialog
                    categories={allCategoryOptions}
                    defaultCategoryKey={category.key}
                    maxTier={summary.battery.maxTier}
                    variants={VARIANTS}
                    events={summary.events.map((event) => ({
                      id: event.trackWorkoutId,
                      name: event.eventName,
                      linkedTestName: event.linkedTestName,
                    }))}
                    onCreate={handleCreateTest}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ThresholdTable
                tests={category.tests.filter((test) => test.includedInScoring)}
                maxTier={summary.battery.maxTier}
                variant={activeVariant}
                draft={draft}
                onChange={handleRawValueChange}
                categories={allCategoryOptions}
                onUpdateTest={handleUpdateTest}
                onDeleteTest={handleDeleteTest}
                competitionId={summary.competitionId}
              />
              {category.tests.some((test) => !test.includedInScoring) && (
                <div className="mt-4 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Deferred
                  </p>
                  <ul className="mt-2 space-y-1">
                    {category.tests
                      .filter((test) => !test.includedInScoring)
                      .map((test) => (
                        <li
                          key={test.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{test.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {test.inputUnit} · {test.scoreType}
                            </p>
                          </div>
                          <EditTestDialog
                            test={toEditableTest(test, summary.battery.maxTier)}
                            categories={allCategoryOptions}
                            maxTier={summary.battery.maxTier}
                            variants={VARIANTS}
                            onUpdate={handleUpdateTest}
                            onDelete={handleDeleteTest}
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || changedCount === 0}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save tier table
          </Button>
        </div>
      </div>
    </div>
  )
}

function ThresholdTable({
  tests,
  maxTier,
  variant,
  draft,
  onChange,
  categories,
  onUpdateTest,
  onDeleteTest,
  competitionId,
}: {
  tests: BenchmarkScoringTierTest[]
  maxTier: number
  variant: string
  draft: Record<string, string>
  onChange: (input: {
    testId: string
    variant: string
    tier: number
    rawValue: string
  }) => void
  categories: CategoryOption[]
  onUpdateTest: (testId: string, updates: Partial<TestDraft>) => Promise<void>
  onDeleteTest: (testId: string) => Promise<void>
  competitionId: string
}) {
  const tierHeaders = Array.from({ length: maxTier }, (_, index) => index + 1)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-52">Test</TableHead>
          {tierHeaders.map((tier) => (
            <TableHead key={`tier-${tier}`} className="w-24 text-center">
              T{tier}
            </TableHead>
          ))}
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tests.map((test) => (
          <TableRow key={test.id}>
            <TableCell className="align-top">
              <div className="space-y-1">
                <p className="font-medium">{test.name}</p>
                <p className="text-xs text-muted-foreground">
                  {test.inputUnit} · {test.scoreType}
                </p>
                {test.scoreModel === "hybrid" && test.hybridFlipTier ? (
                  <p className="text-xs text-muted-foreground">
                    Reps at cap: T1–T{test.hybridFlipTier - 1} · Time: T
                    {test.hybridFlipTier}–T{maxTier}
                  </p>
                ) : null}
                {test.linkedEvent ? (
                  <Link
                    to="/compete/organizer/$competitionId/events/$eventId"
                    params={{
                      competitionId,
                      eventId: test.linkedEvent.trackWorkoutId,
                    }}
                    className="block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Event: {test.linkedEvent.eventName}
                  </Link>
                ) : (
                  <Link
                    to="/compete/organizer/$competitionId/events"
                    params={{ competitionId }}
                    className="block text-xs font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700"
                  >
                    No event linked
                  </Link>
                )}
              </div>
            </TableCell>
            {Array.from({ length: maxTier }, (_, index) => {
              const tier = index + 1
              const key = draftKey(test.id, variant, tier)
              return (
                <TableCell key={tier} className="align-top">
                  <Label htmlFor={key} className="sr-only">
                    {test.name} {variant} tier {tier}
                  </Label>
                  <Input
                    id={key}
                    value={draft[key] ?? ""}
                    onChange={(event) =>
                      onChange({
                        testId: test.id,
                        variant,
                        tier,
                        rawValue: event.target.value,
                      })
                    }
                    placeholder={
                      test.scoreModel === "hybrid" && test.hybridFlipTier
                        ? tier < test.hybridFlipTier
                          ? "reps"
                          : "mm:ss"
                        : undefined
                    }
                    className="h-8 w-24 px-1.5 text-center text-sm tabular-nums"
                  />
                </TableCell>
              )
            })}
            <TableCell className="align-top text-right">
              <EditTestDialog
                test={toEditableTest(test, maxTier)}
                categories={categories}
                maxTier={maxTier}
                variants={VARIANTS}
                onUpdate={onUpdateTest}
                onDelete={onDeleteTest}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function toEditableTest(
  test: BenchmarkScoringTierTest,
  maxTier: number,
): EditableTest {
  const hasCompleteThresholds = benchmarkVariantSchema.options.every(
    (variant) =>
      (test.variants.find((entry) => entry.variant === variant)?.thresholds
        .length ?? 0) === maxTier,
  )

  return {
    id: test.id,
    name: test.name,
    categoryKey: test.categoryKey,
    scheme: test.scheme,
    scoreType: test.scoreType,
    inputUnit: test.inputUnit,
    includedInScoring: test.includedInScoring,
    scoreModel: test.scoreModel,
    hybridFlipTier: test.hybridFlipTier,
    hasCompleteThresholds,
  }
}

function buildDraft(
  summary: BenchmarkScoringTierSummary,
): Record<string, string> {
  const draft: Record<string, string> = {}
  for (const category of summary.categories) {
    for (const test of category.tests) {
      if (!test.includedInScoring) continue
      for (const variant of test.variants) {
        for (const threshold of variant.thresholds) {
          draft[draftKey(test.id, variant.variant, threshold.tier)] =
            threshold.rawValue
        }
      }
    }
  }
  return draft
}

function flattenThresholdUpdates(
  summary: BenchmarkScoringTierSummary,
  draft: Record<string, string>,
) {
  return summary.categories.flatMap((category) =>
    category.tests.flatMap((test) => {
      if (!test.includedInScoring) return []
      return test.variants.flatMap((variant) =>
        variant.thresholds.map((threshold) => ({
          testId: test.id,
          variant: variant.variant,
          tier: threshold.tier,
          rawValue:
            draft[draftKey(test.id, variant.variant, threshold.tier)] ?? "",
        })),
      )
    }),
  )
}

function draftKey(testId: string, variant: string, tier: number) {
  return `${testId}:${variant}:${tier}`
}
