import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME, SITE_URL } from '~/constants'
import { getCompetition } from '~/server/competitions'
import { formatUTCDateShort } from '~/utils/date-utils'

// Month names for UTC formatting (short form for OG image)
const MONTH_NAMES_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
]

/**
 * Normalize a value that may be a Date, numeric timestamp, or null to Date | null.
 * Treats invalid values as null.
 */
function normalizeToDate(
	value: Date | number | null | undefined,
): Date | null {
	if (value == null) return null
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value
	}
	if (typeof value === 'number') {
		const date = new Date(value)
		return Number.isNaN(date.getTime()) ? null : date
	}
	return null
}

/**
 * Format a date range using UTC methods to avoid timezone issues.
 * For date-only fields stored as UTC midnight, this ensures consistent display.
 * Uses short month names (e.g., "Jan 15 - 17, 2026") for OG image.
 */
function formatDateRangeShort({
	start,
	end,
}: {
	start: Date | number
	end: Date | number
}): string {
	const startDate = normalizeToDate(start)
	const endDate = normalizeToDate(end)

	if (!startDate || !endDate) return ''

	const startMonth = MONTH_NAMES_SHORT[startDate.getUTCMonth()]
	const endMonth = MONTH_NAMES_SHORT[endDate.getUTCMonth()]
	const startDay = startDate.getUTCDate()
	const endDay = endDate.getUTCDate()
	const startYear = startDate.getUTCFullYear()
	const endYear = endDate.getUTCFullYear()

	// Same day
	if (
		startYear === endYear &&
		startMonth === endMonth &&
		startDay === endDay
	) {
		return `${startMonth} ${startDay}, ${endYear}`
	}

	// Same month
	if (startYear === endYear && startMonth === endMonth) {
		return `${startMonth} ${startDay} - ${endDay}, ${endYear}`
	}

	// Different months
	return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`
}

type RegistrationStatus =
	| { status: 'open'; opensAt: Date; closesAt: Date }
	| { status: 'opens_soon'; opensAt: Date }
	| { status: 'closed' }
	| { status: 'none' }

/**
 * Determine registration status from potentially mixed Date/timestamp inputs.
 * Normalizes inputs to Date | null before comparisons.
 */
function getRegistrationStatus({
	registrationOpensAt,
	registrationClosesAt,
}: {
	registrationOpensAt: Date | number | null | undefined
	registrationClosesAt: Date | number | null | undefined
}): RegistrationStatus {
	const opensAt = normalizeToDate(registrationOpensAt)
	const closesAt = normalizeToDate(registrationClosesAt)

	if (!opensAt || !closesAt) {
		return { status: 'none' }
	}

	const now = new Date()

	if (now < opensAt) {
		return { status: 'opens_soon', opensAt }
	}

	if (now >= opensAt && now <= closesAt) {
		return { status: 'open', opensAt, closesAt }
	}

	return { status: 'closed' }
}

export const Route = createFileRoute('/api/og-competition')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					const { searchParams } = new URL(request.url)
					const slug = searchParams.get('slug')

					if (!slug) {
						return new Response(
							'Missing slug parameter',
							{ status: 400 },
						)
					}

					const competition = await getCompetition(slug)

					if (!competition) {
						return new Response(
							'Competition not found',
							{ status: 404 },
						)
					}

					const logoUrl =
						competition.profileImageUrl ||
						`${SITE_URL}/wodsmith-logo-no-text.png`

					const competitionDates = formatDateRangeShort({
						start: competition.startDate,
						end: competition.endDate,
					})

					const registrationStatus = getRegistrationStatus({
						registrationOpensAt:
							competition.registrationOpensAt,
						registrationClosesAt:
							competition.registrationClosesAt,
					})

					let registrationStatusHtml = ''
					if (registrationStatus.status === 'open') {
						registrationStatusHtml = `
							<div style="color: #22c55e; font-size: 24px;">
								Registration Open: ${formatUTCDateShort(registrationStatus.opensAt)} - ${formatUTCDateShort(registrationStatus.closesAt)}
							</div>
						`
					} else if (
						registrationStatus.status ===
						'opens_soon'
					) {
						registrationStatusHtml = `
							<div style="color: #eab308; font-size: 24px;">
								Registration Opens ${formatUTCDateShort(registrationStatus.opensAt)}
							</div>
						`
					} else if (registrationStatus.status === 'closed') {
						registrationStatusHtml = `
							<div style="color: #737373; font-size: 24px;">
								Registration Closed
							</div>
						`
					}

					const ogHtml = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width" />
	<title>${competition.name}</title>
	<style>
		body {
			margin: 0;
			padding: 60px 80px;
			width: 1200px;
			height: 630px;
			background: linear-gradient(to top, #000000 0%, #0a0a0a 50%, #000000 100%);
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
		}
		.header {
			display: flex;
			align-items: center;
			gap: 32px;
		}
		.logo {
			width: 120px;
			height: 120px;
			border-radius: 16px;
			object-fit: cover;
		}
		.title {
			font-size: 64px;
			font-weight: bold;
			color: white;
			line-height: 1.1;
			letter-spacing: -0.02em;
			flex: 1
			max-width: 900px;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.info-card {
			background: linear-gradient(to top, #000000 0%, #1a1a1a 100%);
			border-radius: 16px;
			border: 2px solid #2a2a2a;
			padding: 32px 40px;
			box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
			display: flex;
			flex-direction: column;
			gap: 16px;
		}
		.date-row {
			display: flex;
			align-items: center;
			gap: 12px;
			font-size: 28px;
			color: #e5e5e5;
		}
		.branding {
			display: flex;
			align-items: center;
			gap: 16px;
		}
		.brand-logo {
			width: 50px;
			height: 50px;
			border-radius: 8px;
		}
		.site-name {
			font-size: 32px;
			font-weight: bold;
			color: white;
			letter-spacing: -0.01em;
		}
		.accent {
			position: absolute;
			bottom: 0;
			left: 0
			right: 0
			height: 8px;
			background: linear-gradient(90deg, #ff7033 0%, #ff9066 100%);
		}
	</style>
</head>
<body>
	<div class="header">
		<img alt="${competition.name}" class="logo" src="${logoUrl}" />
		<div class="title">${competition.name}</div>
	</div>
	
	<div class="info-card">
		<div class="date-row">
			📅 ${competitionDates}
		</div>
		${registrationStatusHtml}
	</div>

	<div class="branding">
		<img alt="${SITE_NAME}" class="brand-logo" src="${SITE_URL}/wodsmith-logo-no-text.png" />
		<div class="site-name">${SITE_NAME}</div>
	</div>

	<div class="accent"></div>
</body>
</html>
					`

					return new Response(ogHtml, {
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
						},
					})
				} catch (e: unknown) {
					console.error('OG image generation error:', e)
					return new Response(
						'Failed to generate the image',
						{ status: 500 },
					)
				}
			},
		},
	},
})
