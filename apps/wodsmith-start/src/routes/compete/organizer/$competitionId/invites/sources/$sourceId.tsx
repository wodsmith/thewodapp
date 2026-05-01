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
      seriesCompCount: sourceResult.seriesCompCount,
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

function InviteSourceDetailsPage() {
  const {
    source,
    seriesCompCount,
    championshipDivisions,
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

  // Source default applied per-division when no override row exists.
  // Mirrors `sourceDefaultPerDivision` in the server-side allocations
  // helper. Derived directly from the source row + seriesCompCount so the
  // formula breakdown shown to the organizer always matches what the
  // resolver computes — no inference from the resolved allocation map.
  const directSpotsPerComp = source.directSpotsPerComp ?? 0
  const globalSpots = source.globalSpots ?? 0
  const compCount = seriesCompCount ?? 0
  const sourceDefaultPerDivision =
    source.kind === "series"
      ? directSpotsPerComp * compCount + globalSpots
      : globalSpots

  // Seed the per-division override map from the raw allocation rows.
  // Presence of a row in `rawAllocationsForSource` means "override is
  // active for this division" (toggle off, spots = row.spots). Absence
  // means "uses source default" (toggle on, spots = source default for
  // display only).
  const overridesByDivisionId = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rawAllocationsForSource) {
      map.set(row.championshipDivisionId, row.spots)
    }
    return map
  }, [rawAllocationsForSource])

  const initialOverrides = useMemo<Record<string, OverrideState>>(() => {
    const out: Record<string, OverrideState> = {}
    for (const division of championshipDivisions) {
      const overrideSpots = overridesByDivisionId.get(division.id)
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
  }, [championshipDivisions, overridesByDivisionId, sourceDefaultPerDivision])

  const [overrides, setOverrides] =
    useState<Record<string, OverrideState>>(initialOverrides)

  const setRow = (divisionId: string, patch: Partial<OverrideState>) => {
    setOverrides((prev) => ({
      ...prev,
      [divisionId]: { ...prev[divisionId], ...patch },
    }))
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
          sourceGroupId: values.kind === "series" ? values.sourceGroupId : null,
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
    // Build the allocation payload. `useDefault === true` → null (delete
    // override). `useDefault === false` → numeric value, clamped ≥ 0.
    const allocations: Array<{
      championshipDivisionId: string
      spots: number | null
    }> = []
    for (const division of championshipDivisions) {
      const row = overrides[division.id]
      if (!row) continue
      if (row.useDefault) {
        allocations.push({
          championshipDivisionId: division.id,
          spots: null,
        })
      } else {
        const trimmed = row.spots.trim()
        if (trimmed === "") {
          setAllocationError(
            `Enter a number for ${division.label} or toggle "Use default".`,
          )
          return
        }
        const parsed = Number(trimmed)
        if (
          !Number.isFinite(parsed) ||
          parsed < 0 ||
          !Number.isInteger(parsed)
        ) {
          setAllocationError("Spots must be 0 or greater.")
          return
        }
        allocations.push({
          championshipDivisionId: division.id,
          spots: parsed,
        })
      }
    }
    setSavingAllocations(true)
    try {
      await saveAllocations({ data: { sourceId: source.id, allocations } })
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

  const onDiscard = () => {
    setOverrides(initialOverrides)
    setAllocationError(null)
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

      <Card>
        <CardHeader>
          <CardTitle>Per-division allocation</CardTitle>
          <CardDescription className="space-y-1">
            <div>
              Override how many spots this source contributes per championship
              division. Toggle a row off to set an explicit value.
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-foreground">
              <span className="text-muted-foreground">
                Default per division:
              </span>{" "}
              <span className="font-semibold tabular-nums">
                {sourceDefaultPerDivision}
              </span>{" "}
              {source.kind === "series" ? (
                <span className="text-muted-foreground">
                  ={" "}
                  <span className="tabular-nums text-foreground">
                    {directSpotsPerComp}
                  </span>{" "}
                  direct ×{" "}
                  <span className="tabular-nums text-foreground">
                    {compCount}
                  </span>{" "}
                  {compCount === 1 ? "comp" : "comps"} +{" "}
                  <span className="tabular-nums text-foreground">
                    {globalSpots}
                  </span>{" "}
                  global
                </span>
              ) : (
                <span className="text-muted-foreground">
                  = top{" "}
                  <span className="tabular-nums text-foreground">
                    {globalSpots}
                  </span>{" "}
                  qualifies, applied to every division
                </span>
              )}
            </div>
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
              disabled={savingAllocations || championshipDivisions.length === 0}
            >
              {savingAllocations ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
