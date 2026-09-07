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
  /** Optional callback to override the default organizer capacity save */
  onSaveCapacity?: (data: {
    competitionId: string
    teamId: string
    defaultMaxSpotsPerDivision: number | null
    maxTotalRegistrations: number | null
  }) => Promise<unknown>
}

export function CapacitySettingsForm({ competition, onSaveCapacity }: Props) {
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
      const parsedValue = maxSpots.trim() === "" ? null : Number(maxSpots)

      if (
        parsedValue !== null &&
        (!Number.isInteger(parsedValue) || parsedValue < 1)
      ) {
        toast.error("Please enter a valid number (1 or higher)")
        setIsSubmitting(false)
        return
      }

      const parsedTotal = maxTotal.trim() === "" ? null : Number(maxTotal)

      if (
        parsedTotal !== null &&
        (!Number.isFinite(parsedTotal) ||
          !Number.isInteger(parsedTotal) ||
          parsedTotal < 1)
      ) {
        toast.error("Please enter a valid number (1 or higher)")
        setIsSubmitting(false)
        return
      }

      const capacityData = {
        competitionId: competition.id,
        teamId: competition.organizingTeamId,
        defaultMaxSpotsPerDivision: parsedValue,
        maxTotalRegistrations: parsedTotal,
      }
      if (onSaveCapacity) {
        await onSaveCapacity(capacityData)
      } else {
        await updateCapacity({ data: capacityData })
      }
      toast.success("Capacity settings updated")
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValidCapacity = (value: string) =>
    value.trim() === "" ||
    (Number.isInteger(Number(value)) && Number(value) >= 1)
  const invalidSpots = !isValidCapacity(maxSpots)
  const invalidTotal = !isValidCapacity(maxTotal)
  const hasChanges =
    (maxSpots.trim() === "" ? null : Number(maxSpots)) !==
      competition.defaultMaxSpotsPerDivision ||
    (maxTotal.trim() === "" ? null : Number(maxTotal)) !==
      competition.maxTotalRegistrations

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
              aria-invalid={invalidTotal}
              aria-describedby={invalidTotal ? "maxTotal-error" : undefined}
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
          {invalidTotal && (
            <p
              id="maxTotal-error"
              role="alert"
              className="text-sm text-destructive"
            >
              Enter a whole number of 1 or higher, or leave blank for unlimited.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Maximum total registrations across all divisions.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxSpots">Default spots per division</Label>
          <div className="flex items-center gap-4">
            <Input
              id="maxSpots"
              aria-invalid={invalidSpots}
              aria-describedby={invalidSpots ? "maxSpots-error" : undefined}
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
          {invalidSpots && (
            <p
              id="maxSpots-error"
              role="alert"
              className="text-sm text-destructive"
            >
              Enter a whole number of 1 or higher, or leave blank for unlimited.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Athletes will see available spots and cannot register when a
            division is full.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSubmitting || !hasChanges || invalidSpots || invalidTotal}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  )
}
