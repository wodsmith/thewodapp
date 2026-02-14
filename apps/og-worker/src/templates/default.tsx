export function DefaultTemplate() {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "#0c0a09",
				fontFamily: "Inter, sans-serif",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Gradient top border */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: "6px",
					backgroundImage:
						"linear-gradient(90deg, #ea580c 0%, #f97316 40%, #fb923c 70%, transparent 100%)",
				}}
			/>

			{/* Orange radial glow - top right */}
			<div
				style={{
					position: "absolute",
					top: "-200px",
					right: "-100px",
					width: "600px",
					height: "600px",
					borderRadius: "50%",
					backgroundImage:
						"radial-gradient(circle, rgba(234, 88, 12, 0.12) 0%, transparent 70%)",
				}}
			/>

			{/* Orange radial glow - bottom left */}
			<div
				style={{
					position: "absolute",
					bottom: "-250px",
					left: "-150px",
					width: "500px",
					height: "500px",
					borderRadius: "50%",
					backgroundImage:
						"radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)",
				}}
			/>

			{/* Logo */}
			<img
				src="https://wodsmith.com/wodsmith-logo-1000.png"
				alt=""
				width={160}
				height={160}
				style={{ marginBottom: "32px", position: "relative" }}
			/>

			{/* Title */}
			<h1
				style={{
					color: "#fafaf9",
					fontSize: "56px",
					fontWeight: 700,
					letterSpacing: "-0.02em",
					position: "relative",
				}}
			>
				WODsmith
			</h1>
		</div>
	)
}
