import { Link, useLocation } from "@tanstack/react-router"
import { Fragment } from "react"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface BreadcrumbSegment {
	label: string
	href?: string
}

/**
 * Route segment to human-readable label mapping
 */
const SEGMENT_LABELS: Record<string, string> = {
	// Root
	compete: "Competitions",

	// Public competition pages
	leaderboard: "Leaderboard",
	"my-schedule": "My Schedule",
	register: "Register",
	success: "Success",
	schedule: "Schedule",
	scores: "Scores",
	teams: "Teams",
	volunteer: "Volunteer",
	workouts: "Workouts",

	// Athlete pages
	athlete: "Athlete",
	edit: "Edit",
	invoices: "Invoices",
	sponsors: "Sponsors",

	// Organizer pages
	organizer: "Organizer",
	new: "New Competition",
	series: "Series",
	settings: "Settings",
	payouts: "Payouts",
	onboard: "Get Started",
	pending: "Pending",

	// Competition management
	athletes: "Athletes",
	"danger-zone": "Danger Zone",
	divisions: "Divisions",
	events: "Events",
	pricing: "Pricing",
	results: "Results",
	revenue: "Revenue",
	volunteers: "Volunteers",
	waivers: "Waivers",

	// Invite
	invite: "Invitation",
}

/**
 * Segments to skip in breadcrumb (pathless layouts, index routes)
 */
const SKIP_SEGMENTS = new Set(["_dashboard", "index"])

/**
 * Get label for a route segment
 */
function getSegmentLabel(segment: string): string {
	// Check predefined labels
	if (SEGMENT_LABELS[segment]) {
		return SEGMENT_LABELS[segment]
	}

	// For dynamic segments (IDs), return empty - will be handled by context
	if (segment.startsWith("$")) {
		return ""
	}

	// Capitalize and replace hyphens with spaces
	return segment
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

interface CompeteBreadcrumbProps {
	/**
	 * Optional overrides for dynamic segments (e.g., competition name instead of ID)
	 * Key is the segment value, value is the display label
	 */
	dynamicLabels?: Record<string, string>
}

export function CompeteBreadcrumb({
	dynamicLabels = {},
}: CompeteBreadcrumbProps) {
	const location = useLocation()
	const pathname = location.pathname

	// Build breadcrumb segments from pathname
	const pathSegments = pathname.split("/").filter(Boolean)
	const segments: BreadcrumbSegment[] = []

	let currentPath = ""

	for (let i = 0; i < pathSegments.length; i++) {
		const segment = pathSegments[i]

		// Skip pathless layout segments
		if (SKIP_SEGMENTS.has(segment)) {
			continue
		}

		currentPath += `/${segment}`

		// Get label - check dynamic labels first, then predefined, then format
		let label = dynamicLabels[segment] || getSegmentLabel(segment)

		// Skip segments with no label (unresolved dynamic segments)
		if (!label) {
			continue
		}

		// Don't add href for the last segment (current page)
		const isLast = i === pathSegments.length - 1
		segments.push({
			label,
			href: isLast ? undefined : currentPath,
		})
	}

	// Don't render if only one segment (just "Competitions")
	if (segments.length <= 1) {
		return null
	}

	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				{segments.map((segment, index) => {
					const isLast = index === segments.length - 1

					return (
						<Fragment key={`${segment.label}-${index}`}>
							{index > 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{isLast || !segment.href ? (
									<BreadcrumbPage>{segment.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={segment.href}>{segment.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					)
				})}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
