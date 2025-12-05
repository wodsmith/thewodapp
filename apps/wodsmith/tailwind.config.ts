import { heroui } from "@heroui/react"
import type { Config } from "tailwindcss"

/**
 * WODsmith Tailwind Configuration
 * Based on the Compete Design System Specification
 */
const config: Config = {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
		// Include @repo/ui components
		"../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			backgroundImage: {
				"gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
				"gradient-conic":
					"conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
			},
			borderRadius: {
				lg: "var(--radius-lg)",
				md: "var(--radius-md)",
				sm: "var(--radius-sm)",
			},
			colors: {
				// Orange brand palette
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
				// Semantic success colors
				success: {
					50: "rgb(var(--success-50) / <alpha-value>)",
					100: "rgb(var(--success-100) / <alpha-value>)",
					500: "rgb(var(--success-500) / <alpha-value>)",
					600: "rgb(var(--success-600) / <alpha-value>)",
					900: "rgb(var(--success-900) / <alpha-value>)",
					DEFAULT: "rgb(var(--success) / <alpha-value>)",
					foreground: "rgb(var(--success-foreground) / <alpha-value>)",
				},
				// Semantic error colors
				error: {
					50: "rgb(var(--error-50) / <alpha-value>)",
					100: "rgb(var(--error-100) / <alpha-value>)",
					500: "rgb(var(--error-500) / <alpha-value>)",
					600: "rgb(var(--error-600) / <alpha-value>)",
					900: "rgb(var(--error-900) / <alpha-value>)",
				},
				// Semantic warning colors
				warning: {
					50: "rgb(var(--warning-50) / <alpha-value>)",
					100: "rgb(var(--warning-100) / <alpha-value>)",
					500: "rgb(var(--warning-500) / <alpha-value>)",
					600: "rgb(var(--warning-600) / <alpha-value>)",
					900: "rgb(var(--warning-900) / <alpha-value>)",
					DEFAULT: "rgb(var(--warning) / <alpha-value>)",
					foreground: "rgb(var(--warning-foreground) / <alpha-value>)",
				},
				// Semantic info colors
				info: {
					50: "rgb(var(--info-50) / <alpha-value>)",
					100: "rgb(var(--info-100) / <alpha-value>)",
					500: "rgb(var(--info-500) / <alpha-value>)",
					600: "rgb(var(--info-600) / <alpha-value>)",
					900: "rgb(var(--info-900) / <alpha-value>)",
					DEFAULT: "rgb(var(--info) / <alpha-value>)",
					foreground: "rgb(var(--info-foreground) / <alpha-value>)",
				},
				// Theme colors
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
			fontFamily: {
				sans: [
					"-apple-system",
					"BlinkMacSystemFont",
					'"Segoe UI"',
					"Roboto",
					"Oxygen",
					"Ubuntu",
					"Cantarell",
					'"Fira Sans"',
					'"Droid Sans"',
					'"Helvetica Neue"',
					"sans-serif",
				],
				mono: [
					"ui-monospace",
					"SFMono-Regular",
					'"SF Mono"',
					"Menlo",
					"Consolas",
					'"Liberation Mono"',
					"monospace",
				],
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
	plugins: [
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require("@tailwindcss/typography"),
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require("tailwindcss-animate"),
		heroui(),
	],
}
export default config
