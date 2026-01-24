import { createId } from "@paralleldrive/cuid2"

export interface EventResourceFactory {
	id: string
	eventId: string
	title: string
	description: string | null
	url: string | null
	sortOrder: number
	createdAt: Date
	updatedAt: Date
	updateCounter: number | null
}

/**
 * Create a test event resource with sensible defaults.
 * All properties can be overridden.
 *
 * @example
 * ```ts
 * const resource = createEventResource({ eventId: event.id })
 * const videoResource = createEventResource({
 *   eventId: event.id,
 *   title: "Movement Standards",
 *   url: "https://youtube.com/watch?v=..."
 * })
 * ```
 */
export function createEventResource(
	overrides?: Partial<EventResourceFactory>,
): EventResourceFactory {
	const id = overrides?.id ?? `eres_${createId()}`
	const now = new Date()
	return {
		id,
		eventId: overrides?.eventId ?? `trwk_${createId()}`,
		title: overrides?.title ?? `Resource ${id.slice(0, 8)}`,
		description: overrides?.description ?? null,
		url: overrides?.url ?? null,
		sortOrder: overrides?.sortOrder ?? 1,
		createdAt: overrides?.createdAt ?? now,
		updatedAt: overrides?.updatedAt ?? now,
		updateCounter: overrides?.updateCounter ?? 0,
		...overrides,
	}
}
