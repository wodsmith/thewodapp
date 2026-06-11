"use client"

/**
 * Series Source Sub-Tabs
 *
 * For a series-kind source, render per-comp tabs plus a series-global tab.
 * Matches the visual of `SeriesGlobalView` from
 * `project/invites/app.jsx` minus the invite pills (Phase 1 is
 * read-only; invite state arrives in Phase 2).
 *
 * Leaderboard data is passed in rather than fetched here so the page
 * loader owns the server-fn calls — the component stays purely
 * presentational.
 */

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
export interface SeriesCompView {
  competitionId: string
  competitionName: string
  entries: Array<{
    rank: number
    athleteName: string
    points: number | null
  }>
}

export interface SeriesGlobalView {
  entries: Array<{
    rank: number
    athleteName: string
    bestFinish: string | null
    points: number | null
  }>
}

interface SeriesSourceSubTabsProps {
  comps: SeriesCompView[]
  globalView: SeriesGlobalView | null
}

export function SeriesSourceSubTabs({
  comps,
  globalView,
}: SeriesSourceSubTabsProps) {
  const defaultTab = comps[0]?.competitionId ?? "global"
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="flex flex-wrap">
        {comps.map((c) => (
          <TabsTrigger key={c.competitionId} value={c.competitionId}>
            {c.competitionName}
          </TabsTrigger>
        ))}
        <TabsTrigger value="global">Series global</TabsTrigger>
      </TabsList>
      {comps.map((c) => (
        <TabsContent
          key={c.competitionId}
          value={c.competitionId}
          className="mt-3"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead className="w-20 text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.entries.map((e) => (
                <TableRow key={`${c.competitionId}-${e.rank}`}>
                  <TableCell className="tabular-nums">#{e.rank}</TableCell>
                  <TableCell>{e.athleteName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.points ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      ))}
      <TabsContent value="global" className="mt-3">
        {globalView && globalView.entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead>Best finish</TableHead>
                <TableHead className="w-20 text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {globalView.entries.map((e) => (
                <TableRow key={`global-${e.rank}`}>
                  <TableCell className="tabular-nums">#{e.rank}</TableCell>
                  <TableCell>{e.athleteName}</TableCell>
                  <TableCell>{e.bestFinish ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.points ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No series global standings yet for this source.
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
