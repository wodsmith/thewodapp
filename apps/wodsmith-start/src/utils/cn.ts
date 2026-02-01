import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Custom tailwind-merge configured to recognize Tailwind v4 @theme colors.
 * Without this, custom colors like bg-sidebar and bg-background aren't
 * recognized as conflicting classes and both would be kept.
 */
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			colors: [
				"background",
				"foreground",
				"card",
				"card-foreground",
				"popover",
				"popover-foreground",
				"primary",
				"primary-foreground",
				"secondary",
				"secondary-foreground",
				"muted",
				"muted-foreground",
				"accent",
				"accent-foreground",
				"destructive",
				"destructive-foreground",
				"border",
				"input",
				"ring",
				"chart-1",
				"chart-2",
				"chart-3",
				"chart-4",
				"chart-5",
				"sidebar",
				"sidebar-foreground",
				"sidebar-primary",
				"sidebar-primary-foreground",
				"sidebar-accent",
				"sidebar-accent-foreground",
				"sidebar-border",
				"sidebar-ring",
			],
		},
	},
})

/**
 * Combines multiple class names with proper Tailwind CSS conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
