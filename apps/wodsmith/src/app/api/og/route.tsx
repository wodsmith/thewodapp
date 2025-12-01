import { ImageResponse } from "next/og"
import { SITE_NAME, SITE_URL } from "@/constants"

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url)

		// ?title=<title>&description=<description>
		const hasTitle = searchParams.has("title")
		const title = hasTitle
			? searchParams.get("title")?.slice(0, 100)
			: "Track your workouts and progress"

		const hasDescription = searchParams.has("description")
		const rawDescription = hasDescription
			? searchParams.get("description")
			: null

		// Truncate description intelligently to fit nicely on the card
		// Aim for ~200 characters max to ensure it fits well
		let description = rawDescription
		if (description && description.length > 200) {
			// Try to cut at a natural break point (period, newline, or space)
			const naturalBreaks = [
				description.lastIndexOf(".", 200),
				description.lastIndexOf("\n", 200),
				description.lastIndexOf(" ", 200),
			]
			const breakPoint = Math.max(...naturalBreaks)
			if (breakPoint > 100) {
				// Only use natural break if it's not too early
				description = `${description.slice(0, breakPoint + 1).trim()}...`
			} else {
				// Otherwise just hard cut at 200 chars
				description = `${description.slice(0, 200).trim()}...`
			}
		}

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
					padding: "80px",
					fontFamily: "system-ui, -apple-system, sans-serif",
				}}
			>
				{/* Main content area */}
				<div
					style={{
						display: "flex",
						flexDirection: description ? "row" : "column",
						flex: 1,
						justifyContent: description ? "space-between" : "center",
						alignItems: description ? "flex-start" : "flex-start",
						width: "100%",
						paddingTop: "20px",
						paddingBottom: "20px",
					}}
				>
					{/* Title */}
					<div
						style={{
							fontSize: description ? "56px" : "72px",
							fontWeight: "bold",
							color: "white",
							lineHeight: "1.2",
							letterSpacing: "-0.02em",
							maxWidth: description ? "380px" : "1000px",
							flex: description ? "0 0 auto" : "none",
						}}
					>
						{title}
					</div>

					{/* Description - with frame */}
					{description && (
						<div
							style={{
								fontSize: "24px",
								color: "#e5e5e5",
								lineHeight: "1.6",
								fontWeight: "normal",
								background: "linear-gradient(to top, #000000 0%, #1a1a1a 100%)",
								borderRadius: "16px",
								border: "2px solid #2a2a2a",
								maxWidth: "550px",
								boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
								display: "flex",
								flexDirection: "column",
								padding: "40px",
							}}
						>
							<div
								style={{
									overflow: "hidden",
									display: "-webkit-box",
									WebkitLineClamp: 7,
									WebkitBoxOrient: "vertical",
									whiteSpace: "pre-wrap",
								}}
							>
								{description}
							</div>
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
						marginTop: "40px",
					}}
				>
					{/* biome-ignore lint/performance/noImgElement: OG image route can't use Next Image */}
					<img
						alt={SITE_NAME}
						height={60}
						src={`${SITE_URL}/wodsmith-logo-no-text.png`}
						width={60}
						style={{
							borderRadius: "8px",
						}}
					/>
					<div
						style={{
							fontSize: "40px",
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
		if (typeof e === "object" && e !== null && "message" in e) {
			console.log(`${(e as { message: string }).message}`)
		} else {
			console.log("Unknown error", e)
		}
		return new Response("Failed to generate the image", {
			status: 500,
		})
	}
}
