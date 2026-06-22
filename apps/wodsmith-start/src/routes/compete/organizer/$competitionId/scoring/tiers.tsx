"use client"

import { createFileRoute, notFound } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AlertTriangle, CheckCircle2, Gauge, Loader2, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
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
import type {
  BenchmarkScoringTierSummary,
  BenchmarkScoringTierTest,
} from "@/server/benchmark-scoring-tiers"
import {
  activateBenchmarkOnlineScoringFn,
  activateBenchmarkScoringFn,
  getBenchmarkScoringTiersFn,
  saveBenchmarkScoringTiersFn,
} from "@/server-fns/benchmark-scoring-tier-fns"

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
          ? `Benchmark tiers - ${loaderData.competition.name}`
          : "Benchmark tiers",
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
            Benchmark Tier Scoring
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Configure the fixed tier thresholds used by this benchmark battery.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="flex gap-3 py-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-semibold">Benchmark battery setup required</h2>
            <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          </div>
        </CardContent>
      </Card>
    </div>
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
  const [isActivating, setIsActivating] = useState(false)
  const [isSwitchingToOnline, setIsSwitchingToOnline] = useState(false)
  const saveTiers = useServerFn(saveBenchmarkScoringTiersFn)
  const activateScoring = useServerFn(activateBenchmarkScoringFn)
  const activateOnlineScoring = useServerFn(activateBenchmarkOnlineScoringFn)
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
      toast.success("Benchmark tiers saved")
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

  const handleActivate = async () => {
    setIsActivating(true)
    try {
      const nextSummary = await activateScoring({
        data: { competitionId: summary.competitionId },
      })
      setSummary(nextSummary)
      setDraft(buildDraft(nextSummary))
      toast.success("Absolute-tier scoring activated")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to activate benchmark scoring",
      )
    } finally {
      setIsActivating(false)
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

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              Benchmark Tier Scoring
            </h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Configure the fixed tier thresholds used by this benchmark battery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={summary.isActive ? "default" : "secondary"}>
            {summary.isActive ? "Active scoring" : "Not active"}
          </Badge>
          <Badge variant="outline">{summary.battery.maxTier} tiers</Badge>
          <Badge variant="outline">
            {summary.includedTestCount} scored tests
          </Badge>
        </div>
      </div>

      {summary.isActive ? (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">
                Benchmark tier scoring is active
              </h2>
              <p className="text-sm text-muted-foreground">
                The leaderboard is currently using these fixed benchmark tier
                thresholds.
              </p>
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
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <h2 className="font-semibold">
                  Absolute-tier scoring is not active
                </h2>
                <p className="text-sm text-muted-foreground">
                  This benchmark has a tier battery, but the leaderboard is not
                  currently using it as the scoring algorithm.
                </p>
              </div>
            </div>
            <Button onClick={handleActivate} disabled={isActivating}>
              {isActivating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Activate tier scoring
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Battery" value={summary.battery.name} />
        <MetricCard
          label="Scoring scale"
          value={`${summary.battery.scoreMax} points`}
        />
        <MetricCard
          label="Threshold rows"
          value={String(summary.thresholdCount)}
        />
        <MetricCard
          label="Deferred tests"
          value={String(summary.deferredTestCount)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rating Bands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {summary.ratingBands.map((band) => (
              <div
                key={band.key}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm font-medium">{band.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {band.minScore}-{band.maxScore}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
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
                <Badge variant="outline">
                  {category.includedTestCount}/{category.testCount} scored
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ThresholdTable
                tests={category.tests.filter((test) => test.includedInScoring)}
                maxTier={summary.battery.maxTier}
                variant={activeVariant}
                draft={draft}
                onChange={handleRawValueChange}
              />
              {category.tests.some((test) => !test.includedInScoring) && (
                <div className="mt-4 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Deferred
                  </p>
                  <p className="mt-1 text-sm">
                    {category.tests
                      .filter((test) => !test.includedInScoring)
                      .map((test) => test.name)
                      .join(", ")}
                  </p>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 truncate text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function ThresholdTable({
  tests,
  maxTier,
  variant,
  draft,
  onChange,
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
                    className="h-8 w-20 text-center text-sm tabular-nums"
                  />
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
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
