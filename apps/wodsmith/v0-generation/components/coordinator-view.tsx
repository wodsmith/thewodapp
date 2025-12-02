"use client"

import { Badge } from "@/components/ui/badge"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CoordinatorHeatRow } from "@/components/coordinator-heat-row"
import { X, CloudUpload, Download, RefreshCw, Trash2 } from "lucide-react"
import type { HeatWithScores } from "@/lib/types"
import { syncManager } from "@/lib/offline-sync"
import { useOfflineSync } from "@/hooks/use-offline-sync"

interface CoordinatorViewProps {
  heats: HeatWithScores[]
  onClose: () => void
}

export function CoordinatorView({ heats, onClose }: CoordinatorViewProps) {
  const [lockedHeats, setLockedHeats] = useState<Set<string>>(new Set())
  const { pendingCount } = useOfflineSync()

  // Group heats by division
  const groupedHeats = heats.reduce(
    (acc, heat) => {
      const key = heat.isMixed ? "MIXED HEATS" : heat.divisionName
      if (!acc[key]) acc[key] = []
      acc[key].push(heat)
      return acc
    },
    {} as Record<string, HeatWithScores[]>,
  )

  const handleToggleLock = (heatId: string) => {
    setLockedHeats((prev) => {
      const next = new Set(prev)
      if (next.has(heatId)) {
        next.delete(heatId)
      } else {
        next.add(heatId)
      }
      return next
    })
  }

  const handleTakeOver = (heatId: string) => {
    // TODO: Force logout volunteer and take over scoring
    console.log("[v0] Taking over heat:", heatId)
  }

  const handleEditLanes = (heatId: string) => {
    // TODO: Open lane assignment modal
    console.log("[v0] Editing lanes for heat:", heatId)
  }

  const handleForceSyncAll = async () => {
    const items = await syncManager.getQueuedItems()
    console.log("[v0] Force syncing", items.length, "items")
    // TODO: Implement actual sync logic
  }

  const handleExportCSV = () => {
    console.log("[v0] Exporting data to CSV")
    // TODO: Generate and download CSV
  }

  const handleRecalculateRanks = () => {
    console.log("[v0] Recalculating all ranks")
    // TODO: Trigger rank recalculation
  }

  const handleClearQueue = async () => {
    if (confirm("Are you sure you want to clear the sync queue? This will delete all pending scores.")) {
      await syncManager.clearQueue()
      console.log("[v0] Sync queue cleared")
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Coordinator Mode</h1>
            <Badge variant="secondary">Admin Access</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Global Actions */}
        <div className="border-t bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Global Actions:</span>

            <Button variant="outline" size="sm" onClick={handleForceSyncAll} disabled={pendingCount === 0}>
              <CloudUpload className="mr-2 h-4 w-4" />
              Force Sync All ({pendingCount})
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>

            <Button variant="outline" size="sm" onClick={handleRecalculateRanks}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-Calculate Ranks
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearQueue}
              disabled={pendingCount === 0}
              className="text-destructive bg-transparent"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Queue
            </Button>
          </div>
        </div>
      </div>

      {/* Heat Management */}
      <div className="h-[calc(100vh-180px)] overflow-y-auto p-4">
        <div className="space-y-6">
          {Object.entries(groupedHeats).map(([division, divHeats]) => (
            <div key={division} className="space-y-3">
              <h2 className="text-lg font-semibold uppercase tracking-wide">{division}</h2>
              <div className="space-y-2">
                {divHeats.map((heat) => (
                  <CoordinatorHeatRow
                    key={heat.id}
                    heat={heat}
                    isLocked={lockedHeats.has(heat.id)}
                    onToggleLock={handleToggleLock}
                    onTakeOver={handleTakeOver}
                    onEditLanes={handleEditLanes}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-card p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Total Heats: {heats.length} | Locked: {lockedHeats.size}
          </div>
          <Button onClick={onClose}>Return to Volunteer View</Button>
        </div>
      </div>
    </div>
  )
}
