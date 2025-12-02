import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Standard {
  divisionId: string
  divisionBadge: string
  divisionName: string
  timeCap: number
  load?: number
  height?: number
}

interface StandardsPopoverProps {
  standards: Standard[]
}

export function StandardsPopover({ standards }: StandardsPopoverProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <Info className="h-4 w-4" />
          Standards Legend
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h3 className="font-semibold">Division Standards</h3>
          {standards.map((standard) => (
            <div key={standard.divisionId} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{standard.divisionBadge}</Badge>
                <span className="text-sm font-medium">{standard.divisionName}</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Time Cap:</span>
                  <span className="font-mono">{formatTime(standard.timeCap)}</span>
                </div>
                {standard.load && (
                  <div className="flex justify-between">
                    <span>Load:</span>
                    <span className="font-mono">{standard.load} lbs</span>
                  </div>
                )}
                {standard.height && (
                  <div className="flex justify-between">
                    <span>Height:</span>
                    <span className="font-mono">{standard.height} inches</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
