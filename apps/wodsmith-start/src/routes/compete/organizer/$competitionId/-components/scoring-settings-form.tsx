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
export function ScoringSettingsForm({ competition, events }: Props) {
	const router = useRouter()
	const updateScoringConfig = useServerFn(updateCompetitionScoringConfigFn)
	const [isSaving, setIsSaving] = useState(false)
	const [config, setConfig] = useState<ScoringConfig>(() =>
		parseScoringConfig(competition.settings),
	)

	const handleSave = async () => {
		setIsSaving(true)
		try {
			await updateScoringConfig({
				data: {
					competitionId: competition.id,
					scoringConfig: config,
				},
			})
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
		<div className="space-y-4">
			<ScoringConfigForm
				value={config}
				onChange={setConfig}
				events={events}
				disabled={isSaving}
			/>

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
							Save Scoring Settings
						</>
					)}
				</Button>
			</div>
		</div>
	)
}
