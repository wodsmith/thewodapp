/**
 * Pure helper functions for compete notifications
 * Extracted for testability - no database or external dependencies
 */

/**
 * Format cents to display currency (e.g., 5000 -> "$50.00")
 */
export function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

/**
 * Format date for email display using UTC to preserve calendar date.
 * Competition dates are stored as UTC midnight - using UTC methods
 * ensures consistent display regardless of server/recipient timezone.
 */
export function formatDate(date: Date): string {
	const weekdays = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	]
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]

	const weekday = weekdays[date.getUTCDay()]
	const month = months[date.getUTCMonth()]
	const day = date.getUTCDate()
	const year = date.getUTCFullYear()

	return `${weekday}, ${month} ${day}, ${year}`
}

/**
 * Derive athlete display name from user data
 * Priority: firstName > email prefix > fallback
 */
export function getAthleteName(user: {
	firstName?: string | null
	email?: string | null
}): string {
	if (user.firstName) return user.firstName
	if (user.email) return user.email.split("@")[0] || "Athlete"
	return "Athlete"
}

/**
 * Parse pending teammates count from JSON string
 * Returns 0 if parsing fails or array is empty
 */
export function parsePendingTeammateCount(
	pendingTeammatesJson: string | null | undefined,
): number {
	if (!pendingTeammatesJson) return 0

	try {
		const parsed = JSON.parse(pendingTeammatesJson) as unknown
		if (Array.isArray(parsed)) {
			return parsed.length
		}
		return 0
	} catch {
		return 0
	}
}

/**
 * Check if team roster is complete
 */
export function isTeamComplete(
	currentRosterSize: number,
	maxRosterSize: number,
): boolean {
	return currentRosterSize >= maxRosterSize
}

/**
 * Build team invite link with token
 */
export function buildInviteLink(token: string, baseUrl = "https://wodsmith.com"): string {
	return `${baseUrl}/team-invite?token=${encodeURIComponent(token)}`
}

/**
 * Determine email subject for teammate joined notification
 */
export function getTeammateJoinedSubject(params: {
	isTeamComplete: boolean
	newTeammateName: string
	teamName: string
	competitionName: string
}): string {
	if (params.isTeamComplete) {
		return `Your team is complete for ${params.competitionName}!`
	}
	return `${params.newTeammateName} joined ${params.teamName}`
}
