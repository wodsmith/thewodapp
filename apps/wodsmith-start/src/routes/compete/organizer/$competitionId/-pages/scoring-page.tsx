/**
 * Scoring Configuration Page
 *
 * Shared page body for the organizer and cohost scoring routes. The organizer
 * route renders it with defaults; the cohost route injects a
 * cohost-permissioned save callback.
 */
// @lat: [[organizer-dashboard#Cohost Dashboard#Shared Component Callback Pattern#Shared Page Components]]

import type { ComponentProps } from "react"
import { ScoringSettingsForm } from "../-components/scoring-settings-form"

interface ScoringPageProps {
  competition: ComponentProps<typeof ScoringSettingsForm>["competition"]
  events: ComponentProps<typeof ScoringSettingsForm>["events"]
  onSaveScoringConfig?: ComponentProps<
    typeof ScoringSettingsForm
  >["onSaveScoringConfig"]
}

export function ScoringPage({
  competition,
  events,
  onSaveScoringConfig,
}: ScoringPageProps) {
  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Scoring Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure how athletes are ranked on the leaderboard
        </p>
      </div>

      <ScoringSettingsForm
        competition={{
          id: competition.id,
          name: competition.name,
          settings: competition.settings,
        }}
        events={events}
        onSaveScoringConfig={onSaveScoringConfig}
      />
    </div>
  )
}
