import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx and tailwind-merge
 * This ensures Tailwind classes are properly merged without conflicts
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Type utility for cleaner TypeScript types
 */
export type Prettify<T> = {
	[K in keyof T]: T[K]
} & {}

/**
 * Creates a type-safe event handler
 */
export type EventHandler<E extends React.SyntheticEvent = React.SyntheticEvent> =
	(event: E) => void
