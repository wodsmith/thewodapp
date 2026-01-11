/**
 * Shared email styles for WODsmith emails
 * Brand colors:
 * - Primary (orange): #f97316
 * - Text: #18181b (zinc-900)
 * - Muted text: #71717a (zinc-500)
 * - Border: #e4e4e7 (zinc-200)
 */

export const colors = {
	primary: "#f97316",
	text: "#18181b",
	muted: "#71717a",
	border: "#e4e4e7",
	background: "#ffffff",
	success: "#16a34a",
	warning: "#d97706",
	error: "#dc2626",
} as const

export const main = {
	backgroundColor: colors.background,
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
}

export const container = {
	maxWidth: "480px",
	margin: "0 auto",
	padding: "40px 24px",
}

export const logo = {
	color: colors.text,
	fontSize: "24px",
	fontWeight: "700" as const,
	letterSpacing: "-0.5px",
	textAlign: "center" as const,
	margin: "0 0 32px 0",
}

export const heading = {
	color: colors.text,
	fontSize: "24px",
	fontWeight: "600" as const,
	lineHeight: "32px",
	margin: "0 0 16px 0",
}

export const paragraph = {
	color: colors.text,
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 16px 0",
}

export const muted = {
	color: colors.muted,
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0 0 16px 0",
}

export const buttonContainer = {
	margin: "24px 0",
}

export const button = {
	backgroundColor: colors.primary,
	borderRadius: "6px",
	color: "#ffffff",
	display: "inline-block",
	fontSize: "15px",
	fontWeight: "500" as const,
	textDecoration: "none",
	textAlign: "center" as const,
	padding: "12px 24px",
}

export const link = {
	color: colors.primary,
	textDecoration: "underline",
}

export const hr = {
	borderColor: colors.border,
	margin: "32px 0",
}

export const footer = {
	color: colors.muted,
	fontSize: "12px",
	lineHeight: "18px",
	textAlign: "center" as const,
	margin: "32px 0 0 0",
}

export const infoBox = {
	backgroundColor: "#fafafa",
	borderRadius: "8px",
	padding: "16px",
	margin: "24px 0",
}

export const infoLabel = {
	color: colors.muted,
	fontSize: "12px",
	fontWeight: "500" as const,
	textTransform: "uppercase" as const,
	letterSpacing: "0.5px",
	margin: "0 0 4px 0",
}

export const infoValue = {
	color: colors.text,
	fontSize: "15px",
	fontWeight: "500" as const,
	margin: "0 0 12px 0",
}

export const successBox = {
	backgroundColor: "#f0fdf4",
	borderLeft: `3px solid ${colors.success}`,
	borderRadius: "0 8px 8px 0",
	padding: "12px 16px",
	margin: "24px 0",
}

export const warningBox = {
	backgroundColor: "#fffbeb",
	borderLeft: `3px solid ${colors.warning}`,
	borderRadius: "0 8px 8px 0",
	padding: "12px 16px",
	margin: "24px 0",
}

export const errorBox = {
	backgroundColor: "#fef2f2",
	borderLeft: `3px solid ${colors.error}`,
	borderRadius: "0 8px 8px 0",
	padding: "12px 16px",
	margin: "24px 0",
}

export const boxText = {
	color: colors.text,
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
}
