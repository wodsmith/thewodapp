/**
 * Invite Source details page — ADR-0012 Phase 3.
 *
 * Hosts source meta editing (kind, source comp/series, default spots,
 * notes) plus the per-(championship division) allocation table where the
 * organizer overrides the source's default for specific divisions.
 *
 * The Sources tab's "Edit" button navigates here; the Add flow keeps the
 * existing dialog because there are no overrides to edit at create time.
 */
// @lat: [[competition-invites#Source details page]]

import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  InviteSourceForm,
  type InviteSourceFormValues,
} from "@/components/organizer/invites/invite-source-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getCompetitionGroupsFn,
  getOrganizerCompetitionsFn,
} from "@/server-fns/competition-fns"
import {
  getInviteSourceByIdFn,
  listInviteSourceAllocationsFn,
  saveInviteSourceAllocationsFn,
  updateInviteSourceFn,
} from "@/server-fns/competition-invite-fns"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/invites/sources/$sourceId",
)({
  staleTime: 10_000,
  component: InviteSourceDetailsPage,
  loader: async ({ params, context, parentMatchPromise }) => {
    const session = context.session
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: `/compete/organizer/${params.competitionId}/invites/sources/${params.sourceId}`,
        },
      })
    }

    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    // `getInviteSourceByIdFn` enforces MANAGE_COMPETITIONS on the source's
    // championship organizing team and throws when the source does not
    // exist — the parent error boundary handles both consistently.
    const [
      sourceResult,
      divisionsResult,
      allocationsResult,
      organizerCompsResult,
      organizerGroupsResult,
    ] = await Promise.all([
      getInviteSourceByIdFn({ data: { sourceId: params.sourceId } }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
      // The route-wide allocation map; we slice out this source's row
      // for the override table seed values.
      listInviteSourceAllocationsFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      getOrganizerCompetitionsFn({
        data: { teamId: competition.organizingTeamId },
      }),
      getCompetitionGroupsFn({
        data: { teamId: competition.organizingTeamId },
      }),
    ])

    // Cross-check: a source whose championship doesn't match this URL
    // should not render. The server fn already gates by championship
    // permission via `getCompetitionOrganizingTeamId`, but a URL like
    // `/compete/organizer/A/invites/sources/<sourceForB>` is a typo we
    // can stop early at the loader.
    if (
      sourceResult.source.championshipCompetitionId !== params.competitionId
    ) {
      throw new Error("Source does not belong to this competition")
    }

    const competitionOptions = (organizerCompsResult.competitions ?? [])
      .filter((c: { id: string }) => c.id !== params.competitionId)
      .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
    const seriesOptions = (organizerGroupsResult.groups ?? []).map(
      (g: { id: string; name: string }) => ({ id: g.id, name: g.name }),
    )

    const championshipDivisions = (divisionsResult.divisions ?? []).map(
      (d: { id: string; label: string }) => ({ id: d.id, label: d.label }),
    )

    return {
      source: sourceResult.source,
      championshipDivisions,
      allocationsBySourceByDivision:
        allocationsResult.allocationsBySourceByDivision,
      rawAllocationsForSource:
        allocationsResult.rawAllocationsBySource[params.sourceId] ?? [],
      competitionOptions,
      seriesOptions,
    }
  },
})

interface OverrideState {
  useDefault: boolean
  spots: string
}

interface GlobalSpotsOverrideState {
  useDefault: boolean
  globalSpots: string
}

function InviteSourceDetailsPage() {
  const {
    source,
    championshipDivisions,
    allocationsBySourceByDivision,
    rawAllocationsForSource,
    competitionOptions,
    seriesOptions,
  } = Route.useLoaderData()
  const { competitionId } = Route.useParams()
  const router = useRouter()
  const navigate = useNavigate()

  const updateSource = useServerFn(updateInviteSourceFn)
  const saveAllocations = useServerFn(saveInviteSourceAllocationsFn)

  const [metaError, setMetaError] = useState<string | null>(null)
  const [allocationError, setAllocationError] = useState<string | null>(null)
  const [savingAllocations, setSavingAllocations] = useState(false)
  const [globalSpotsError, setGlobalSpotsError] = useState<string | null>(null)
  const [savingGlobalSpots, setSavingGlobalSpots] = useState(false)

  const isSeriesSource = source.kind === "series"

  // Source default applied per-division when no override row exists.
  // Mirrors `sourceDefaultPerDivision` in the server-side allocations
  // helper — kept simple here because the details page only needs the
  // displayable number, not the full resolution algorithm.
  const sourceDefaultPerDivision = useMemo(() => {
    if (source.kind === "series") {
      // Series default is `directSpotsPerComp * compCount + globalSpots`
      // applied per-division. We only have the resolved per-division
      // total in `allocationsBySourceByDivision[source.id]` — pick any
      // entry where there's no override to derive the default. If we
      // can't (every entry has an override), fall back to the raw
      // globalSpots so the toggle copy still has a number to show.
      const map = allocationsBySourceByDivision[source.id] ?? {}
      const firstDefault = Object.values(map)[0]
      if (typeof firstDefault === "number") return firstDefault
      return source.globalSpots ?? 0
    }
    return source.globalSpots ?? 0
  }, [source, allocationsBySourceByDivision])

  // Source-level globalSpots default for series sources. The per-division
  // global-spots overrides table seeds its "Use default" rows from this
  // value so the organizer always sees the number that would apply if
  // they turned off the override.
  const sourceGlobalSpotsDefault = source.globalSpots ?? 0

  // Seed the per-division override maps from the raw allocation rows.
  // A row may carry an override on either axis (spots / globalSpots) or
  // both — we filter each map by axis so the two cards are independent.
  const totalOverridesByDivisionId = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rawAllocationsForSource) {
      if (row.spots !== null) {
        map.set(row.championshipDivisionId, row.spots)
      }
    }
    return map
  }, [rawAllocationsForSource])

  const globalSpotsOverridesByDivisionId = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rawAllocationsForSource) {
      if (row.globalSpots !== null) {
        map.set(row.championshipDivisionId, row.globalSpots)
      }
    }
    return map
  }, [rawAllocationsForSource])

  const initialOverrides = useMemo<Record<string, OverrideState>>(() => {
    const out: Record<string, OverrideState> = {}
    for (const division of championshipDivisions) {
      const overrideSpots = totalOverridesByDivisionId.get(division.id)
      if (overrideSpots !== undefined) {
        out[division.id] = {
          useDefault: false,
          spots: String(overrideSpots),
        }
      } else {
        out[division.id] = {
          useDefault: true,
          spots: String(sourceDefaultPerDivision),
        }
      }
    }
    return out
  }, [championshipDivisions, totalOverridesByDivisionId, sourceDefaultPerDivision])

  const initialGlobalSpotsOverrides = useMemo<
    Record<string, GlobalSpotsOverrideState>
  >(() => {
    const out: Record<string, GlobalSpotsOverrideState> = {}
    for (const division of championshipDivisions) {
      const overrideGlobal = globalSpotsOverridesByDivisionId.get(division.id)
      if (overrideGlobal !== undefined) {
        out[division.id] = {
          useDefault: false,
          globalSpots: String(overrideGlobal),
        }
      } else {
        out[division.id] = {
          useDefault: true,
          globalSpots: String(sourceGlobalSpotsDefault),
        }
      }
    }
    return out
  }, [
    championshipDivisions,
    globalSpotsOverridesByDivisionId,
    sourceGlobalSpotsDefault,
  ])

  const [overrides, setOverrides] =
    useState<Record<string, OverrideState>>(initialOverrides)

  const [globalSpotsOverrides, setGlobalSpotsOverrides] = useState<
    Record<string, GlobalSpotsOverrideState>
  >(initialGlobalSpotsOverrides)

  const setRow = (divisionId: string, patch: Partial<OverrideState>) => {
    setOverrides((prev) => ({
      ...prev,
      [divisionId]: { ...prev[divisionId], ...patch },
    }))
  }

  const setGlobalSpotsRow = (
    divisionId: string,
    patch: Partial<GlobalSpotsOverrideState>,
  ) => {
    setGlobalSpotsOverrides((prev) => ({
      ...prev,
      [divisionId]: { ...prev[divisionId], ...patch },
    }))
  }

  // Build the merged payload for `saveInviteSourceAllocationsFn`. Both
  // axes are persisted on the same row keyed by (sourceId, divisionId);
  // each save (whether triggered from the totals card or the global-spots
  // card) sends the current local state of both axes so the row's other
  // axis isn't accidentally cleared.
  const buildAllocationPayload = (): {
    payload: Array<{
      championshipDivisionId: string
      spots: number | null
      globalSpots: number | null
    }>
    error: string | null
  } => {
    const payload: Array<{
      championshipDivisionId: string
      spots: number | null
      globalSpots: number | null
    }> = []
    for (const division of championshipDivisions) {
      const totalRow = overrides[division.id]
      const globalRow = globalSpotsOverrides[division.id]

      let spotsValue: number | null = null
      if (totalRow && !totalRow.useDefault) {
        const trimmed = totalRow.spots.trim()
        if (trimmed === "") {
          return {
            payload: [],
            error: `Enter a number for ${division.label} or toggle "Use default" in per-division allocation.`,
          }
        }
        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
          return { payload: [], error: "Spots must be 0 or greater." }
        }
        spotsValue = parsed
      }

      let globalSpotsValue: number | null = null
      if (isSeriesSource && globalRow && !globalRow.useDefault) {
        const trimmed = globalRow.globalSpots.trim()
        if (trimmed === "") {
          return {
            payload: [],
            error: `Enter a number for ${division.label} or toggle "Use default" in per-division global spots.`,
          }
        }
        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
          return {
            payload: [],
            error: "Global spots must be 0 or greater.",
          }
        }
        globalSpotsValue = parsed
      }

      payload.push({
        championshipDivisionId: division.id,
        spots: spotsValue,
        globalSpots: globalSpotsValue,
      })
    }
    return { payload, error: null }
  }

  const onMetaSubmit = async (values: InviteSourceFormValues) => {
    setMetaError(null)
    try {
      await updateSource({
        data: {
          id: source.id,
          championshipCompetitionId: competitionId,
          kind: values.kind,
          sourceCompetitionId:
            values.kind === "competition" ? values.sourceCompetitionId : null,
          sourceGroupId:
            values.kind === "series" ? values.sourceGroupId : null,
          directSpotsPerComp:
            values.kind === "series"
              ? (values.directSpotsPerComp ?? null)
              : null,
          globalSpots: values.globalSpots ?? null,
          notes: values.notes ?? null,
        },
      })
      toast.success("Source updated")
      router.invalidate()
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Failed to save source")
    }
  }

  const onSaveAllocations = async () => {
    setAllocationError(null)
    setGlobalSpotsError(null)
    const { payload, error } = buildAllocationPayload()
    if (error) {
      setAllocationError(error)
      return
    }
    setSavingAllocations(true)
    try {
      await saveAllocations({
        data: { sourceId: source.id, allocations: payload },
      })
      toast.success("Per-division allocations saved")
      router.invalidate()
    } catch (err) {
      setAllocationError(
        err instanceof Error ? err.message : "Failed to save allocations",
      )
    } finally {
      setSavingAllocations(false)
    }
  }

  const onSaveGlobalSpots = async () => {
    setGlobalSpotsError(null)
    setAllocationError(null)
    const { payload, error } = buildAllocationPayload()
    if (error) {
      setGlobalSpotsError(error)
      return
    }
    setSavingGlobalSpots(true)
    try {
      await saveAllocations({
        data: { sourceId: source.id, allocations: payload },
      })
      toast.success("Per-division global spots saved")
      router.invalidate()
    } catch (err) {
      setGlobalSpotsError(
        err instanceof Error ? err.message : "Failed to save global spots",
      )
    } finally {
      setSavingGlobalSpots(false)
    }
  }

  const onDiscard = () => {
    setOverrides(initialOverrides)
    setAllocationError(null)
  }

  const onDiscardGlobalSpots = () => {
    setGlobalSpotsOverrides(initialGlobalSpotsOverrides)
    setGlobalSpotsError(null)
  }

  const sourceLabel =
    source.kind === "series"
      ? (seriesOptions.find((g) => g.id === source.sourceGroupId)?.name ??
        "Unknown series")
      : (competitionOptions.find((c) => c.id === source.sourceCompetitionId)
          ?.name ?? "Unknown competition")

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to="/compete/organizer/$competitionId/invites"
                  params={{ competitionId }}
                >
                  Invites
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{sourceLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{sourceLabel}</h1>
            <p className="text-muted-foreground">
              Edit the source's defaults and override allocation per
              championship division.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/compete/organizer/$competitionId/invites",
                params: { competitionId },
              })
            }
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to invites
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source meta</CardTitle>
          <CardDescription>
            Kind, source competition or series, default spots, and notes.
            Already-issued invites are not affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteSourceForm
            defaultValues={source}
            competitionOptions={competitionOptions}
            seriesOptions={seriesOptions}
            onSubmit={onMetaSubmit}
            submitLabel="Save changes"
          />
          {metaError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{metaError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {isSeriesSource ? (
        <Card>
          <CardHeader>
            <CardTitle>Per-division global spots</CardTitle>
            <CardDescription>
              Override how many global-leaderboard qualifiers this series
              contributes per championship division. Replaces the source's{" "}
              <span className="font-semibold">global spots</span> default
              (currently{" "}
              <span className="font-semibold">{sourceGlobalSpotsDefault}</span>
              ) for the rows you toggle off. The per-comp direct tier
              (directSpotsPerComp × series comps) is unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {championshipDivisions.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                This championship has no divisions yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Division</TableHead>
                    <TableHead className="w-32">Global spots</TableHead>
                    <TableHead className="w-40">Use default</TableHead>
                    <TableHead className="w-40">Override globals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {championshipDivisions.map((division) => {
                    const row = globalSpotsOverrides[division.id]
                    if (!row) return null
                    const resolvedDisplay = row.useDefault
                      ? sourceGlobalSpotsDefault
                      : (() => {
                          const n = Number(row.globalSpots)
                          return Number.isFinite(n) ? n : 0
                        })()
                    return (
                      <TableRow key={division.id}>
                        <TableCell className="font-medium">
                          {division.label}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              row.useDefault
                                ? "text-muted-foreground"
                                : "font-semibold"
                            }
                          >
                            {resolvedDisplay}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={`use-default-globals-${division.id}`}
                              checked={row.useDefault}
                              onCheckedChange={(v) =>
                                setGlobalSpotsRow(division.id, {
                                  useDefault: v === true,
                                  globalSpots: row.globalSpots,
                                })
                              }
                              aria-label={`Use default global spots for ${division.label}`}
                            />
                            <label
                              htmlFor={`use-default-globals-${division.id}`}
                              className="text-muted-foreground"
                            >
                              Default ({sourceGlobalSpotsDefault})
                            </label>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            disabled={row.useDefault}
                            value={row.globalSpots}
                            onChange={(e) =>
                              setGlobalSpotsRow(division.id, {
                                globalSpots: e.target.value,
                              })
                            }
                            aria-label={`Override global spots for ${division.label}`}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            {globalSpotsError ? (
              <Alert variant="destructive">
                <AlertDescription>{globalSpotsError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onDiscardGlobalSpots}
                disabled={savingGlobalSpots}
              >
                Discard
              </Button>
              <Button
                type="button"
                onClick={onSaveGlobalSpots}
                disabled={
                  savingGlobalSpots || championshipDivisions.length === 0
                }
              >
                {savingGlobalSpots ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Per-division allocation</CardTitle>
          <CardDescription>
            Override how many spots this source contributes per championship
            division. Default is{" "}
            <span className="font-semibold">{sourceDefaultPerDivision}</span>{" "}
            per division. Toggle a row off to set an explicit value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {championshipDivisions.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              This championship has no divisions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Division</TableHead>
                  <TableHead className="w-32">Resolved</TableHead>
                  <TableHead className="w-40">Use default</TableHead>
                  <TableHead className="w-40">Override spots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {championshipDivisions.map((division) => {
                  const row = overrides[division.id]
                  if (!row) return null
                  const resolvedDisplay = row.useDefault
                    ? sourceDefaultPerDivision
                    : (() => {
                        const n = Number(row.spots)
                        return Number.isFinite(n) ? n : 0
                      })()
                  return (
                    <TableRow key={division.id}>
                      <TableCell className="font-medium">
                        {division.label}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            row.useDefault
                              ? "text-muted-foreground"
                              : "font-semibold"
                          }
                        >
                          {resolvedDisplay}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={`use-default-${division.id}`}
                            checked={row.useDefault}
                            onCheckedChange={(v) =>
                              setRow(division.id, {
                                useDefault: v === true,
                                spots: row.spots,
                              })
                            }
                            aria-label={`Use default for ${division.label}`}
                          />
                          <label
                            htmlFor={`use-default-${division.id}`}
                            className="text-muted-foreground"
                          >
                            Default ({sourceDefaultPerDivision})
                          </label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          disabled={row.useDefault}
                          value={row.spots}
                          onChange={(e) =>
                            setRow(division.id, { spots: e.target.value })
                          }
                          aria-label={`Override spots for ${division.label}`}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          {allocationError ? (
            <Alert variant="destructive">
              <AlertDescription>{allocationError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onDiscard}
              disabled={savingAllocations}
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={onSaveAllocations}
              disabled={
                savingAllocations || championshipDivisions.length === 0
              }
            >
              {savingAllocations ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

