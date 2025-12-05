"use client"

import posthog from "posthog-js"
import { useEffect, useRef } from "react"

interface CompetitionViewTrackerProps {
	competitionId: string
	competitionSlug: string
	competitionName: string
	isRegistered: boolean
	isOrganizer: boolean
}

/**
 * Client-side component to track competition page views in PostHog.
 * Renders nothing visible - purely for analytics tracking.
 */
export function CompetitionViewTracker({
	competitionId,
	competitionSlug,
	competitionName,
	isRegistered,
	isOrganizer,
}: CompetitionViewTrackerProps) {
	const hasTracked = useRef(false)

	useEffect(() => {
		if (!hasTracked.current) {
			hasTracked.current = true
			posthog.capture("competition_viewed", {
				competition_id: competitionId,
				competition_slug: competitionSlug,
				competition_name: competitionName,
				is_registered: isRegistered,
				is_organizer: isOrganizer,
			})
		}
	}, [competitionId, competitionSlug, competitionName, isRegistered, isOrganizer])

	return null
}
