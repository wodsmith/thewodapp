"use client"

import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2, Save } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ScoringConfigForm } from "@/components/compete/scoring-config-form"
import { Button } from "@/components/ui/button"
import { DEFAULT_SCORING_CONFIG } from "@/lib/scoring"
import { updateCompetitionScoringConfigFn } from "@/server-fns/competition-detail-fns"
import type { ScoringConfig } from "@/types/scoring"

/**
 * Props for the ScoringSettingsForm component
 */
interface Props {
  competition: {
    id: string
    name: string
    settings: string | null
  }
  /** Optional list of events for head-to-head tiebreaker selection */
  events?: Array<{ id: string; name: string }>
  /** Optional callback to override the default organizer save action */
  onSaveScoringConfig?: (data: {
    competitionId: string
    scoringConfig: ScoringConfig
  }) => Promise<unknown>
  /**
   * Hard-codes the ranking algorithm to "online" (benchmark boards): hides
   * the algorithm picker and forces the saved config to online while keeping
   * tiebreaker and DNF/DNS settings editable.
   */
  lockAlgorithmOnline?: boolean
}

/**
 * Force a scoring config onto the online ranking algorithm (benchmark boards)
 */
function forceOnlineAlgorithm(config: ScoringConfig): ScoringConfig {
  if (config.algorithm === "online") return config
  return { ...config, algorithm: "online", customTable: undefined }
}

/**
 * Parse scoring config from competition settings
 */
function parseScoringConfig(settings: string | null): ScoringConfig {
  if (!settings) return DEFAULT_SCORING_CONFIG

  try {
    const parsed = JSON.parse(settings)
    if (parsed.scoringConfig) {
      return parsed.scoringConfig as ScoringConfig
    }
    return DEFAULT_SCORING_CONFIG
  } catch {
    return DEFAULT_SCORING_CONFIG
  }
}

/**
 * Scoring Settings Form
 *
 * Wraps ScoringConfigForm with save functionality for competition settings.
 */
export function ScoringSettingsForm({
  competition,
  events,
  onSaveScoringConfig,
  lockAlgorithmOnline = false,
}: Props) {
  const router = useRouter()
  const updateScoringConfig = useServerFn(updateCompetitionScoringConfigFn)
  const [isSaving, setIsSaving] = useState(false)
  const [config, setConfig] = useState<ScoringConfig>(() => {
    const parsed = parseScoringConfig(competition.settings)
    return lockAlgorithmOnline ? forceOnlineAlgorithm(parsed) : parsed
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Re-force on submit so a locked competition can never save a
      // non-online algorithm even if local state drifted.
      const scoringConfig = lockAlgorithmOnline
        ? forceOnlineAlgorithm(config)
        : config
      if (onSaveScoringConfig) {
        await onSaveScoringConfig({
          competitionId: competition.id,
          scoringConfig,
        })
      } else {
        await updateScoringConfig({
          data: {
            competitionId: competition.id,
            scoringConfig,
          },
        })
      }
      toast.success("Scoring configuration saved")
      router.invalidate()
    } catch (error) {
      console.error("Failed to save scoring config:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save scoring configuration",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <ScoringConfigForm
        value={config}
        onChange={setConfig}
        events={events}
        disabled={isSaving}
        lockAlgorithmOnline={lockAlgorithmOnline}
      />

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save scoring settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
