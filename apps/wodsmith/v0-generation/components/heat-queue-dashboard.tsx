"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { HeatCard } from "@/components/heat-card"
import type { HeatWithScores } from "@/lib/types"
import { Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface HeatQueueDashboardProps {
  heats: HeatWithScores[]
  onHeatSelect: (heatId: string) => void
  onCoordinatorMode: () => void
}

export function HeatQueueDashboard({ heats, onHeatSelect, onCoordinatorMode }: HeatQueueDashboardProps) {
  const [divisionFilter, setDivisionFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Group heats by division
  const groupedHeats = heats.reduce(
    (acc, heat) => {
      const key = heat.isMixed ? "mixed" : heat.divisionName
      if (!acc[key]) acc[key] = []
      acc[key].push(heat)
      return acc
    },
    {} as Record<string, HeatWithScores[]>,
  )

  // Get unique divisions for filter
  const divisions = Array.from(new Set(heats.map((h) => h.divisionName))).sort()

  // Apply filters
  const filteredHeats = divisionFilter === "all" ? heats : heats.filter((h) => h.divisionName === divisionFilter)

  const statusFilteredHeats =
    statusFilter === "all"
      ? filteredHeats
      : filteredHeats.filter((h) => {
          if (statusFilter === "upcoming") return h.status === "upcoming"
          if (statusFilter === "active") return h.status === "active" || h.status === "scoring"
          if (statusFilter === "complete") return h.status === "complete"
          return true
        })

  return (
    <div className="flex min-h-screen flex-col">
      {/* Filters */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map((div) => (
                <SelectItem key={div} value={div}>
                  {div}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming Only</SelectItem>
              <SelectItem value="active">Active/Scoring</SelectItem>
              <SelectItem value="complete">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Heat List */}
      <div className="flex-1 space-y-8 p-4">
        {divisionFilter === "all" ? (
          // Grouped view
          Object.entries(groupedHeats).map(([division, divHeats]) => (
            <div key={division} className="space-y-3">
              <div className="border-b pb-2">
                <h2 className="text-lg font-semibold uppercase tracking-wide text-foreground">
                  {division === "mixed" ? "Mixed Heat (Transition)" : division}
                </h2>
              </div>
              <div className="space-y-3">
                {divHeats.map((heat) => (
                  <HeatCard key={heat.id} heat={heat} onResume={() => onHeatSelect(heat.id)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Flat filtered view
          <div className="space-y-3">
            {statusFilteredHeats.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No heats found matching your filters</div>
            ) : (
              statusFilteredHeats.map((heat) => (
                <HeatCard key={heat.id} heat={heat} onResume={() => onHeatSelect(heat.id)} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="border-t bg-card p-4">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onCoordinatorMode}>
            Switch to Coordinator View
          </Button>
          <Button variant="outline">Refresh</Button>
        </div>
      </div>
    </div>
  )
}
