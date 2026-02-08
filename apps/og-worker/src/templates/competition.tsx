interface CompetitionData {
	name: string
	slug: string
	description: string | null
	profileImageUrl: string | null
	bannerImageUrl: string | null
	startDate: string
	endDate: string
	timezone: string
	competitionType: "in-person" | "online"
	organizingTeam: {
		name: string
		avatarUrl: string | null
	} | null
}

interface Props {
	competition: CompetitionData
}

export function CompetitionTemplate({ competition }: Props) {
	const logoUrl =
		competition.profileImageUrl || competition.organizingTeam?.avatarUrl || null

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
				padding: "48px",
				fontFamily: "Inter, system-ui, sans-serif",
			}}
		>
			{/* Top section: Logo + Content */}
			<div style={{ display: "flex", flex: 1, gap: "40px", alignItems: "flex-start" }}>
				{/* Competition logo */}
				{logoUrl && (
					<div
						style={{
							width: "180px",
							height: "180px",
							borderRadius: "16px",
							overflow: "hidden",
							flexShrink: 0,
							border: "2px solid rgba(255,255,255,0.1)",
						}}
					>
						<img
							src={logoUrl}
							width={180}
							height={180}
							style={{ objectFit: "cover" }}
						/>
					</div>
				)}

				{/* Text content */}
				<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
					{/* Competition type badge */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							background:
								competition.competitionType === "online"
									? "rgba(59, 130, 246, 0.2)"
									: "rgba(34, 197, 94, 0.2)",
							border: `1px solid ${competition.competitionType === "online" ? "#3b82f6" : "#22c55e"}`,
							color:
								competition.competitionType === "online" ? "#60a5fa" : "#4ade80",
							padding: "6px 14px",
							borderRadius: "20px",
							fontSize: "16px",
							fontWeight: 500,
							width: "fit-content",
						}}
					>
						{competition.competitionType === "online"
							? "Online Competition"
							: "In-Person Event"}
					</div>

					{/* Competition name */}
					<h1
						style={{
							color: "white",
							fontSize: competition.name.length > 40 ? "48px" : "56px",
							fontWeight: 700,
							marginTop: "20px",
							lineHeight: 1.15,
							letterSpacing: "-0.02em",
						}}
					>
						{competition.name}
					</h1>

					{/* Dates */}
					<p
						style={{
							color: "#94a3b8",
							fontSize: "24px",
							marginTop: "16px",
							fontWeight: 400,
						}}
					>
						{formatDateRange(
							competition.startDate,
							competition.endDate,
							competition.timezone,
						)}
					</p>
				</div>
			</div>

			{/* Bottom section: Branding */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginTop: "32px",
					paddingTop: "24px",
					borderTop: "1px solid rgba(255,255,255,0.1)",
				}}
			>
				{/* WODsmith branding */}
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<img
						src="https://wodsmith.com/wodsmith-logo-no-text.png"
						width={36}
						height={36}
						style={{ opacity: 0.8 }}
					/>
					<span style={{ color: "#64748b", fontSize: "18px", fontWeight: 500 }}>
						wodsmith.com
					</span>
				</div>

				{/* Organizing team */}
				{competition.organizingTeam && (
					<span style={{ color: "#475569", fontSize: "16px" }}>
						Hosted by {competition.organizingTeam.name}
					</span>
				)}
			</div>
		</div>
	)
}

function formatDateRange(
	startDate: string,
	endDate: string,
	timezone: string,
): string {
	const options: Intl.DateTimeFormatOptions = {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: timezone,
	}

	const start = new Date(`${startDate}T12:00:00`)
	const end = new Date(`${endDate}T12:00:00`)

	if (startDate === endDate) {
		return start.toLocaleDateString("en-US", options)
	}

	const startMonth = start.toLocaleDateString("en-US", {
		month: "long",
		timeZone: timezone,
	})
	const endMonth = end.toLocaleDateString("en-US", {
		month: "long",
		timeZone: timezone,
	})
	const startYear = start.toLocaleDateString("en-US", {
		year: "numeric",
		timeZone: timezone,
	})
	const endYear = end.toLocaleDateString("en-US", {
		year: "numeric",
		timeZone: timezone,
	})

	if (startMonth === endMonth && startYear === endYear) {
		const startDay = start.toLocaleDateString("en-US", {
			day: "numeric",
			timeZone: timezone,
		})
		const endDay = end.toLocaleDateString("en-US", {
			day: "numeric",
			timeZone: timezone,
		})
		return `${startMonth} ${startDay} - ${endDay}, ${endYear}`
	}

	if (startYear === endYear) {
		return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: timezone })} - ${end.toLocaleDateString("en-US", options)}`
	}

	return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`
}
