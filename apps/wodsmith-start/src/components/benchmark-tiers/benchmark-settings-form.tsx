"use client"

import { AlertTriangle, Loader2, Save } from "lucide-react"
import { useEffect, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { BenchmarkVideoPolicy } from "@/schemas/benchmark.schema"

export interface BenchmarkSettingsDraft {
  name: string
  description?: string | null
  scoreMax: number
  maxTier: number
  videoPolicy: BenchmarkVideoPolicy
}

export interface BenchmarkSettingsFormProps {
  settings: {
    name: string
    description: string | null
    scoreMax: number
    maxTier: number
    videoPolicy: string
  }
  disabled?: boolean
  onSave: (settings: BenchmarkSettingsDraft) => Promise<void>
}

const VIDEO_POLICY_OPTIONS: ReadonlyArray<{
  value: BenchmarkVideoPolicy
  label: string
}> = [
  { value: "never", label: "Never require video" },
  { value: "for_top_scores", label: "Require for top scores" },
  { value: "always", label: "Always require video" },
]

export function BenchmarkSettingsForm({
  settings,
  disabled = false,
  onSave,
}: BenchmarkSettingsFormProps) {
  const [name, setName] = useState(settings.name)
  const [description, setDescription] = useState(settings.description ?? "")
  const [scoreMax, setScoreMax] = useState(String(settings.scoreMax))
  const [maxTier, setMaxTier] = useState(String(settings.maxTier))
  const [videoPolicy, setVideoPolicy] = useState<string>(settings.videoPolicy)
  const [isSaving, setIsSaving] = useState(false)

  // Re-sync the draft whenever a save (or another editor on the page)
  // refreshes the summary from the server.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on server state change only
  useEffect(() => {
    setName(settings.name)
    setDescription(settings.description ?? "")
    setScoreMax(String(settings.scoreMax))
    setMaxTier(String(settings.maxTier))
    setVideoPolicy(settings.videoPolicy)
  }, [
    settings.name,
    settings.description,
    settings.scoreMax,
    settings.maxTier,
    settings.videoPolicy,
  ])

  const parsedScoreMax = Number(scoreMax)
  const parsedMaxTier = Number(maxTier)

  const isValid =
    name.trim().length > 0 &&
    Number.isInteger(parsedScoreMax) &&
    parsedScoreMax > 0 &&
    Number.isInteger(parsedMaxTier) &&
    parsedMaxTier > 0

  const isDirty =
    name !== settings.name ||
    description !== (settings.description ?? "") ||
    scoreMax !== String(settings.scoreMax) ||
    maxTier !== String(settings.maxTier) ||
    videoPolicy !== settings.videoPolicy

  const canSave = !disabled && !isSaving && isValid && isDirty

  const tierDecreased =
    Number.isInteger(parsedMaxTier) && parsedMaxTier < settings.maxTier
  const tierIncreased =
    Number.isInteger(parsedMaxTier) && parsedMaxTier > settings.maxTier

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const trimmedDescription = description.trim()
      await onSave({
        name: name.trim(),
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        scoreMax: parsedScoreMax,
        maxTier: parsedMaxTier,
        videoPolicy: videoPolicy as BenchmarkVideoPolicy,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save benchmark settings",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>Benchmark settings</CardTitle>
        <CardDescription>
          Name your benchmark and choose the scoring scale athletes see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="benchmark-name">Name</Label>
            <Input
              id="benchmark-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              placeholder="e.g. Gym Fitness Benchmark"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="benchmark-video-policy">Video proof</Label>
            <Select
              value={videoPolicy}
              onValueChange={setVideoPolicy}
              disabled={isSaving}
            >
              <SelectTrigger id="benchmark-video-policy">
                <SelectValue placeholder="Select video policy" />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_POLICY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When athletes must attach a video with their score.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="benchmark-description">Description</Label>
          <Textarea
            id="benchmark-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSaving}
            placeholder="Optional description shown to athletes"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="benchmark-max-tier">Number of tiers</Label>
            <Input
              id="benchmark-max-tier"
              type="number"
              min={1}
              value={maxTier}
              onChange={(event) => setMaxTier(event.target.value)}
              disabled={isSaving}
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              How many performance levels each test has. Tier 1 is the easiest
              standard, tier {Number.isInteger(parsedMaxTier) ? parsedMaxTier : settings.maxTier}{" "}
              the hardest.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="benchmark-score-max">Score scale</Label>
            <Input
              id="benchmark-score-max"
              type="number"
              min={1}
              value={scoreMax}
              onChange={(event) => setScoreMax(event.target.value)}
              disabled={isSaving}
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Overall and category scores are shown out of this number, like a
              grade (most benchmarks use 100).
            </p>
          </div>
        </div>

        {(tierDecreased || tierIncreased) && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              {tierDecreased
                ? "Threshold columns above the new tier count will be deleted."
                : "New tier columns start as copies of the last tier — update their thresholds below after saving."}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
