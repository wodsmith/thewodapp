"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateCompetitionDefaultCapacityFn } from "@/server-fns/competition-divisions-fns"

interface Props {
  competition: {
    id: string
    organizingTeamId: string
    defaultMaxSpotsPerDivision: number | null
    maxTotalRegistrations: number | null
  }
}

export function CapacitySettingsForm({ competition }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [maxSpots, setMaxSpots] = useState<string>(
    competition.defaultMaxSpotsPerDivision?.toString() ?? "",
  )
  const [maxTotal, setMaxTotal] = useState<string>(
    competition.maxTotalRegistrations?.toString() ?? "",
  )

  const updateCapacity = useServerFn(updateCompetitionDefaultCapacityFn)

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const parsedValue = maxSpots.trim() === "" ? null : parseInt(maxSpots, 10)

      if (
        parsedValue !== null &&
        (Number.isNaN(parsedValue) || parsedValue < 1)
      ) {
        toast.error("Please enter a valid number (1 or higher)")
        setIsSubmitting(false)
        return
      }

      const parsedTotal = maxTotal.trim() === "" ? null : parseInt(maxTotal, 10)

      if (
        parsedTotal !== null &&
        (Number.isNaN(parsedTotal) || parsedTotal < 1)
      ) {
        toast.error("Please enter a valid number (1 or higher)")
        setIsSubmitting(false)
        return
      }

      await updateCapacity({
        data: {
          competitionId: competition.id,
          teamId: competition.organizingTeamId,
          defaultMaxSpotsPerDivision: parsedValue,
          maxTotalRegistrations: parsedTotal,
        },
      })
      toast.success("Capacity settings updated")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasChanges = (() => {
    const parsed = maxSpots.trim() === "" ? null : parseInt(maxSpots, 10)
    if (parsed !== null && Number.isNaN(parsed)) return false
    const parsedTotal = maxTotal.trim() === "" ? null : parseInt(maxTotal, 10)
    if (parsedTotal !== null && Number.isNaN(parsedTotal)) return false
    return (
      parsed !== competition.defaultMaxSpotsPerDivision ||
      parsedTotal !== competition.maxTotalRegistrations
    )
  })()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Capacity Settings</CardTitle>
        </div>
        <CardDescription>
          Set registration limits for this competition.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="maxTotal">Total competition cap</Label>
          <div className="flex items-center gap-4">
            <Input
              id="maxTotal"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
              className="w-full sm:w-32"
            />
            <span className="text-sm text-muted-foreground">
              Leave blank for unlimited
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum total registrations across all divisions.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxSpots">Default spots per division</Label>
          <div className="flex items-center gap-4">
            <Input
              id="maxSpots"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxSpots}
              onChange={(e) => setMaxSpots(e.target.value)}
              className="w-full sm:w-32"
            />
            <span className="text-sm text-muted-foreground">
              Leave blank for unlimited
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Athletes will see available spots and cannot register when a
            division is full.
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSubmitting || !hasChanges}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  )
}
