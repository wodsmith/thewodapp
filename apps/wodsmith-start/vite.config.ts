import { sentryVitePlugin } from "@sentry/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import alchemy from "alchemy/cloudflare/tanstack-start"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

const config = defineConfig({
	plugins: [
		// MUST be first - handles Cloudflare bindings via Alchemy IaC
		// persistState aligns Vite's miniflare database location with wrangler's
		// so that db:migrate:local applies to the same database Vite uses
		alchemy({
			persistState: {
				path: "./.alchemy/local/.wrangler/state",
			},
		}),
		devtools(),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		// Sentry source map upload — must be last, only when auth token available
		...(process.env.SENTRY_AUTH_TOKEN
			? [
					sentryVitePlugin({
						org: process.env.SENTRY_ORG || "wodsmith",
						project: process.env.SENTRY_PROJECT || "wodsmith-start",
						authToken: process.env.SENTRY_AUTH_TOKEN,
						sourcemaps: {
							filesToDeleteAfterUpload: [
								".output/**/*.map",
								"dist/**/*.map",
							],
						},
						release: {
							name: process.env.GITHUB_SHA?.slice(0, 7) || undefined,
						},
					}),
				]
			: []),
	],
	define: {
		"import.meta.env.VITE_SENTRY_DSN": JSON.stringify(
			"https://a55d70f610d33fa3108b7faea06accb7@o4510933498462208.ingest.us.sentry.io/4510937818005504",
		),
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(
			process.env.GITHUB_SHA?.slice(0, 7) || "",
		),
	},
	build: {
		target: "esnext",
		// Only generate sourcemaps when Sentry can upload and delete them.
		// "hidden" emits .map files without sourceMappingURL comments in JS output.
		// Without the Sentry plugin, .map files would ship to production.
		sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : false,
		rollupOptions: {
			external: ["node:async_hooks", "cloudflare:workers"],
		},
	},
	// Resolve server-only as empty module (Next.js specific, not needed in TanStack Start)
	resolve: {
		alias: {
			"server-only": new URL("./src/lib/server-only-stub.ts", import.meta.url)
				.pathname,
		},
	},
	// Pre-bundle SSR dependencies to avoid mid-session optimization errors
	ssr: {
		optimizeDeps: {
			include: [
				// Utility libraries
				"clsx",
				"tailwind-merge",
				"class-variance-authority",
				// Radix UI components (all installed packages)
				"@radix-ui/react-avatar",
				"@radix-ui/react-checkbox",
				"@radix-ui/react-collapsible",
				"@radix-ui/react-dialog",
				"@radix-ui/react-dropdown-menu",
				"@radix-ui/react-label",
				"@radix-ui/react-popover",
				"@radix-ui/react-scroll-area",
				"@radix-ui/react-select",
				"@radix-ui/react-separator",
				"@radix-ui/react-slot",
				"@radix-ui/react-tabs",
				"@radix-ui/react-tooltip",
			],
		},
	},
})

export default config
