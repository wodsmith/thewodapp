import { ImageResponse } from "next/og"
import { SITE_NAME, SITE_URL } from "@/constants"
import { getCompetition } from "@/server/competitions"

export const runtime = "edge"

function formatDateRange(start: Date, end: Date): string {
	const startMonth = start.toLocaleDateString("en-US", { month: "short" })
	const endMonth = end.toLocaleDateString("en-US", { month: "short" })
	const startDay = start.getDate()
	const endDay = end.getDate()
	const startYear = start.getFullYear()
	const endYear = end.getFullYear()

	// Same day
	if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
		return `${startMonth} ${startDay}, ${endYear}`
	}

	// Same month
	if (startYear === endYear && startMonth === endMonth) {
		return `${startMonth} ${startDay} - ${endDay}, ${endYear}`
	}

	// Different months
	return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	})
}

type RegistrationStatus =
	| { status: "open"; opensAt: Date; closesAt: Date }
	| { status: "opens_soon"; opensAt: Date }
	| { status: "closed" }
	| { status: "none" }

function getRegistrationStatus(
	registrationOpensAt: Date | null,
	registrationClosesAt: Date | null,
): RegistrationStatus {
	if (!registrationOpensAt || !registrationClosesAt) {
		return { status: "none" }
	}

	const now = new Date()

	if (now < registrationOpensAt) {
		return { status: "opens_soon", opensAt: registrationOpensAt }
	}

	if (now >= registrationOpensAt && now <= registrationClosesAt) {
		return {
			status: "open",
			opensAt: registrationOpensAt,
			closesAt: registrationClosesAt,
		}
	}

	return { status: "closed" }
}

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url)
		const slug = searchParams.get("slug")

		if (!slug) {
			return new Response("Missing slug parameter", { status: 400 })
		}

		const competition = await getCompetition(slug)

		if (!competition) {
			return new Response("Competition not found", { status: 404 })
		}

		const logoUrl =
			competition.profileImageUrl || `${SITE_URL}/wodsmith-logo-no-text.png`

		const competitionDates = formatDateRange(
			competition.startDate,
			competition.endDate,
		)

		const registrationStatus = getRegistrationStatus(
			competition.registrationOpensAt,
			competition.registrationClosesAt,
		)

		return new ImageResponse(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					justifyContent: "space-between",
					background:
						"linear-gradient(to top, #000000 0%, #0a0a0a 50%, #000000 100%)",
					padding: "60px 80px",
					fontFamily: "system-ui, -apple-system, sans-serif",
				}}
			>
				{/* Top section: Logo + Title */}
				<div
					style={{
						display: "flex",
						flexDirection: "row",
						alignItems: "center",
						gap: "32px",
						width: "100%",
					}}
				>
					{/* Competition Logo */}
					{/* biome-ignore lint/a11y/useAltText: OG image route */}
					{/* biome-ignore lint/performance/noImgElement: OG image route can't use Next Image */}
					<img
						src={logoUrl}
						width={120}
						height={120}
						style={{
							borderRadius: "16px",
							objectFit: "cover",
						}}
					/>
					{/* Title */}
					<div
						style={{
							fontSize: "64px",
							fontWeight: "bold",
							color: "white",
							lineHeight: "1.1",
							letterSpacing: "-0.02em",
							flex: 1,
							maxWidth: "900px",
							overflow: "hidden",
							textOverflow: "ellipsis",
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
						}}
					>
						{competition.name}
					</div>
				</div>

				{/* Middle section: Dates card */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "16px",
						background: "linear-gradient(to top, #000000 0%, #1a1a1a 100%)",
						borderRadius: "16px",
						border: "2px solid #2a2a2a",
						padding: "32px 40px",
						boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
					}}
				>
					{/* Competition dates */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "12px",
							fontSize: "28px",
							color: "#e5e5e5",
						}}
					>
						{/* Calendar icon */}
						<svg
							width="28"
							height="28"
							viewBox="0 0 24 24"
							fill="none"
							stroke="#e5e5e5"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							role="img"
							aria-label="Calendar"
						>
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
							<line x1="16" y1="2" x2="16" y2="6" />
							<line x1="8" y1="2" x2="8" y2="6" />
							<line x1="3" y1="10" x2="21" y2="10" />
						</svg>
						<span>{competitionDates}</span>
					</div>

					{/* Registration status */}
					{registrationStatus.status === "open" && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								fontSize: "24px",
								color: "#22c55e",
							}}
						>
							<span>
								Registration Open: {formatDate(registrationStatus.opensAt)} -{" "}
								{formatDate(registrationStatus.closesAt)}
							</span>
						</div>
					)}

					{registrationStatus.status === "opens_soon" && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "12px",
								fontSize: "24px",
								color: "#eab308",
							}}
						>
							<span
								style={{
									width: "12px",
									height: "12px",
									borderRadius: "50%",
									background: "#eab308",
								}}
							/>
							<span>
								Registration Opens {formatDate(registrationStatus.opensAt)}
							</span>
						</div>
					)}

					{registrationStatus.status === "closed" && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								fontSize: "24px",
								color: "#737373",
							}}
						>
							<span>Registration Closed</span>
						</div>
					)}
				</div>

				{/* Bottom branding section */}
				<div
					style={{
						display: "flex",
						flexDirection: "row",
						alignItems: "center",
						gap: "16px",
					}}
				>
					{/* biome-ignore lint/a11y/useAltText: OG image route */}
					{/* biome-ignore lint/performance/noImgElement: OG image route can't use Next Image */}
					<img
						src={`${SITE_URL}/wodsmith-logo-no-text.png`}
						height={50}
						width={50}
						style={{
							borderRadius: "8px",
						}}
					/>
					<div
						style={{
							fontSize: "32px",
							fontWeight: "bold",
							color: "white",
							letterSpacing: "-0.01em",
						}}
					>
						{SITE_NAME}
					</div>
				</div>

				{/* Accent line */}
				<div
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						height: "8px",
						background: "linear-gradient(90deg, #ff7033 0%, #ff9066 100%)",
					}}
				/>
			</div>,
			{
				width: 1200,
				height: 630,
			},
		)
	} catch (e: unknown) {
		console.error("OG image generation error:", e)
		return new Response("Failed to generate the image", {
			status: 500,
		})
	}
}
