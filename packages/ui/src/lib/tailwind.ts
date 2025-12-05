import type { Config } from "tailwindcss"

/**
 * Design system Tailwind configuration preset
 * This can be extended by consuming apps
 */
export const uiPreset: Partial<Config> = {
	darkMode: ["class"],
	theme: {
		extend: {
			colors: {
				// Primary brand colors
				orange: {
					50: "rgb(var(--orange-50) / <alpha-value>)",
					100: "rgb(var(--orange-100) / <alpha-value>)",
					200: "rgb(var(--orange-200) / <alpha-value>)",
					300: "rgb(var(--orange-300) / <alpha-value>)",
					400: "rgb(var(--orange-400) / <alpha-value>)",
					500: "rgb(var(--orange-500) / <alpha-value>)",
					600: "rgb(var(--orange-600) / <alpha-value>)",
					700: "rgb(var(--orange-700) / <alpha-value>)",
					800: "rgb(var(--orange-800) / <alpha-value>)",
					900: "rgb(var(--orange-900) / <alpha-value>)",
				},
				// Semantic colors using CSS variables
				background: "rgb(var(--background) / <alpha-value>)",
				foreground: "rgb(var(--foreground) / <alpha-value>)",
				card: {
					DEFAULT: "rgb(var(--card) / <alpha-value>)",
					foreground: "rgb(var(--card-foreground) / <alpha-value>)",
				},
				popover: {
					DEFAULT: "rgb(var(--popover) / <alpha-value>)",
					foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
				},
				primary: {
					DEFAULT: "rgb(var(--primary) / <alpha-value>)",
					foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
				},
				secondary: {
					DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
					foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
				},
				muted: {
					DEFAULT: "rgb(var(--muted) / <alpha-value>)",
					foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
				},
				accent: {
					DEFAULT: "rgb(var(--accent) / <alpha-value>)",
					foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
				},
				destructive: {
					DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
					foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
				},
				success: {
					DEFAULT: "rgb(var(--success) / <alpha-value>)",
					foreground: "rgb(var(--success-foreground) / <alpha-value>)",
				},
				warning: {
					DEFAULT: "rgb(var(--warning) / <alpha-value>)",
					foreground: "rgb(var(--warning-foreground) / <alpha-value>)",
				},
				info: {
					DEFAULT: "rgb(var(--info) / <alpha-value>)",
					foreground: "rgb(var(--info-foreground) / <alpha-value>)",
				},
				border: "rgb(var(--border) / <alpha-value>)",
				input: "rgb(var(--input) / <alpha-value>)",
				ring: "rgb(var(--ring) / <alpha-value>)",
				chart: {
					"1": "rgb(var(--chart-1) / <alpha-value>)",
					"2": "rgb(var(--chart-2) / <alpha-value>)",
					"3": "rgb(var(--chart-3) / <alpha-value>)",
					"4": "rgb(var(--chart-4) / <alpha-value>)",
					"5": "rgb(var(--chart-5) / <alpha-value>)",
				},
				sidebar: {
					DEFAULT: "rgb(var(--sidebar-background) / <alpha-value>)",
					foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
					primary: "rgb(var(--sidebar-primary) / <alpha-value>)",
					"primary-foreground":
						"rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
					accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
					"accent-foreground":
						"rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
					border: "rgb(var(--sidebar-border) / <alpha-value>)",
					ring: "rgb(var(--sidebar-ring) / <alpha-value>)",
				},
			},
			borderRadius: {
				lg: "var(--radius-lg)",
				md: "var(--radius-md)",
				sm: "var(--radius-sm)",
				xl: "var(--radius-xl)",
				"2xl": "var(--radius-2xl)",
			},
			fontFamily: {
				sans: ["var(--font-sans)"],
				mono: ["var(--font-mono)"],
			},
			fontSize: {
				xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
				sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
				base: ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
				lg: ["var(--text-lg)", { lineHeight: "var(--leading-snug)" }],
				xl: ["var(--text-xl)", { lineHeight: "var(--leading-snug)" }],
				"2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-tight)" }],
				"3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
				"4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-tight)" }],
			},
			spacing: {
				"4.5": "1.125rem", // 18px
				"5.5": "1.375rem", // 22px
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
}

export default uiPreset
