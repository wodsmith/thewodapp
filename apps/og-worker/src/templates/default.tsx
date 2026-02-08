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
				background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
				fontFamily: "Inter, system-ui, sans-serif",
			}}
		>
			<img
				src="https://wodsmith.com/wodsmith-logo-1000.png"
				width={200}
				height={200}
				style={{ marginBottom: "32px" }}
			/>
			<h1
				style={{
					color: "white",
					fontSize: "48px",
					fontWeight: 700,
					letterSpacing: "-0.02em",
				}}
			>
				WODsmith
			</h1>
			<p
				style={{
					color: "#64748b",
					fontSize: "24px",
					marginTop: "12px",
				}}
			>
				Competition Management Platform
			</p>
		</div>
	)
}
