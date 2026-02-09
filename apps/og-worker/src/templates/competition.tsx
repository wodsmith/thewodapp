import React from "react"

const WODSMITH_LOGO = "https://wodsmith.com/wodsmith-logo-1000.png"
const WODSMITH_LOGO_SMALL = "https://wodsmith.com/wodsmith-logo-no-text.png"

export interface CompetitionData {
	name: string
	slug: string
	description: string | null
	logoUrl: string | null
	startDate: string
	endDate: string
	timezone: string
	competitionType: "in-person" | "online"
	registrationOpensAt: string | null
	registrationClosesAt: string | null
	location: string | null
	organizingTeam: {
		name: string
	} | null
}

interface Props {
	competition: CompetitionData
}

function getRegistrationLabel(competition: CompetitionData): string {
	const now = new Date()
	const { registrationOpensAt, registrationClosesAt } = competition

	if (!registrationOpensAt && !registrationClosesAt) return ""

	if (registrationOpensAt) {
		const opens = new Date(`${registrationOpensAt}T00:00:00`)
		if (now < opens) return "Opens Soon"
	}

	if (registrationClosesAt) {
		const closes = new Date(`${registrationClosesAt}T23:59:59`)
		if (now <= closes) return "Open"
		return ""
	}

	return "Open"
}

function getRegistrationColor(label: string): string {
	if (label === "Open") return "#22c55e"
	if (label === "Opens Soon") return "#f97316"
	return "#78716c"
}

export function CompetitionTemplate({ competition }: Props) {
	const displayLogo = competition.logoUrl || WODSMITH_LOGO
	const regLabel = getRegistrationLabel(competition)
	const regColor = getRegistrationColor(regLabel)
	const hasReg = regLabel.length > 0

	return (
		<div
			style={{
				width: "1200px",
				height: "630px",
				display: "flex",
				flexDirection: "column",
				backgroundColor: "#0c0a09",
				fontFamily: "Inter, sans-serif",
				alignItems: "center",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Gradient top border */}
			<div
				style={{
					position: "absolute",
					top: "0",
					left: "0",
					width: "1200px",
					height: "6px",
					display: "flex",
					backgroundImage:
						"linear-gradient(90deg, #ea580c 0%, #f97316 40%, #fb923c 70%, transparent 100%)",
				}}
			/>

			{/* Orange glow top right */}
			<div
				style={{
					position: "absolute",
					top: "-200px",
					right: "-100px",
					width: "600px",
					height: "600px",
					borderRadius: "300px",
					display: "flex",
					backgroundImage:
						"radial-gradient(circle, rgba(234, 88, 12, 0.12) 0%, transparent 70%)",
				}}
			/>

			{/* Orange glow bottom left */}
			<div
				style={{
					position: "absolute",
					bottom: "-250px",
					left: "-150px",
					width: "500px",
					height: "500px",
					borderRadius: "250px",
					display: "flex",
					backgroundImage:
						"radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)",
				}}
			/>

			{/* Centering wrapper */}
			<div
				style={{
					display: "flex",
					flexGrow: 1,
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					width: "1072px",
				}}
			>
			{/* Content row */}
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
				}}
			>
				{/* Logo */}
				<div
					style={{
						width: "160px",
						height: "160px",
						borderRadius: "16px",
						overflow: "hidden",
						border: "2px solid #292524",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "#1c1917",
						flexShrink: 0,
					}}
				>
					<img
						src={displayLogo}
						width={competition.logoUrl ? 160 : 120}
						height={competition.logoUrl ? 160 : 120}
						style={{ objectFit: "cover" }}
					/>
				</div>

				{/* Gap between logo and text */}
				<div style={{ display: "flex", width: "36px", flexShrink: 0 }} />

				{/* Text column */}
				<div style={{ display: "flex", flexDirection: "column", maxWidth: "876px", overflow: "hidden" }}>
					{/* Badge row */}
					<div style={{ display: "flex", flexDirection: "row" }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								backgroundColor: "rgba(234, 88, 12, 0.15)",
								borderWidth: "1px",
								borderStyle: "solid",
								borderColor: "rgba(234, 88, 12, 0.3)",
								color: "#ea580c",
								paddingTop: "6px",
								paddingBottom: "6px",
								paddingLeft: "16px",
								paddingRight: "16px",
								borderRadius: "20px",
								fontSize: "16px",
								fontWeight: 600,
							}}
						>
							{competition.competitionType === "online"
								? "Online Competition"
								: "In-Person Event"}
						</div>
					</div>

					{/* Name */}
					<div
						style={{
							display: "flex",
							color: "#fafaf9",
							fontSize: competition.name.length > 40 ? "44px" : "52px",
							fontWeight: 700,
							marginTop: "20px",
							lineHeight: 1.15,
							letterSpacing: "-0.02em",
						}}
					>
						{competition.name}
					</div>

					{/* Date row */}
					<div
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							marginTop: "16px",
						}}
					>
						<div
							style={{
								display: "flex",
								color: "#a8a29e",
								fontSize: "24px",
								fontWeight: 500,
							}}
						>
							{formatDateRange(
								competition.startDate,
								competition.endDate,
								competition.timezone,
							)}
						</div>

						{competition.location ? (
							<div
								style={{
									display: "flex",
									color: "#a8a29e",
									fontSize: "24px",
									fontWeight: 500,
									marginLeft: "28px",
								}}
							>
								{competition.location}
							</div>
						) : null}

						{hasReg ? (
							<div
								style={{
									display: "flex",
									flexDirection: "row",
									alignItems: "center",
									marginLeft: "28px",
								}}
							>
								<div
									style={{
										display: "flex",
										width: "10px",
										height: "10px",
										borderRadius: "5px",
										backgroundColor: regColor,
									}}
								/>
								<div
									style={{
										display: "flex",
										marginLeft: "10px",
										color: regColor,
										fontSize: "20px",
										fontWeight: 600,
									}}
								>
									Registration {regLabel}
								</div>
							</div>
						) : null}
					</div>
				</div>
			</div>

			</div>

			{/* Footer */}
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					borderTop: "1px solid #292524",
					paddingTop: "24px",
					paddingBottom: "40px",
					width: "1072px",
				}}
			>
				<div style={{ display: "flex" }}>
					{competition.organizingTeam ? (
						<div style={{ display: "flex", color: "#57534e", fontSize: "18px" }}>
							Hosted by {competition.organizingTeam.name}
						</div>
					) : (
						<div style={{ display: "flex" }} />
					)}
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "row",
						alignItems: "center",
					}}
				>
					<img src={WODSMITH_LOGO_SMALL} width={28} height={28} />
					<div
						style={{
							display: "flex",
							marginLeft: "14px",
							color: "#78716c",
							fontSize: "18px",
							fontWeight: 500,
						}}
					>
						wodsmith.com
					</div>
				</div>
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
