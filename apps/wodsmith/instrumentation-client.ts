import posthog from "posthog-js"

const isProd = process.env.NODE_ENV === "production"
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (isProd && posthogKey) {
	posthog.init(posthogKey, {
		api_host: "/ingest",
		ui_host: "https://us.posthog.com",
		defaults: "2025-05-24",
		capture_exceptions: true,
		debug: false,
	})
}
