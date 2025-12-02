"use client"

import { useOfflineSync } from "@/hooks/use-offline-sync"
import { WifiOff, Wifi, CloudUpload } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface GlobalHeaderProps {
  eventName: string
}

export function GlobalHeader({ eventName }: GlobalHeaderProps) {
  const { isOnline, pendingCount } = useOfflineSync()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold text-primary">WODSMITH</div>
          <div className="hidden text-sm text-muted-foreground sm:block">{eventName}</div>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline/Online Indicator */}
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            <span className="hidden text-xs text-muted-foreground sm:inline">{isOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Pending Sync Badge */}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <CloudUpload className="h-3 w-3" />
              {pendingCount} Pending
            </Badge>
          )}
        </div>
      </div>
    </header>
  )
}
