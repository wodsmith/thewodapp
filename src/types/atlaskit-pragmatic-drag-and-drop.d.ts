declare module "@atlaskit/pragmatic-drag-and-drop/adapter/element" {
	export type DropEvent = {
		source: { data: { trackWorkoutId: string } }
		destination: { data: { trackWorkoutId: string } }
	}
	export function dropTargetForElements(
		options: Record<string, unknown>,
	): unknown
	export function monitorForElements(options: Record<string, unknown>): unknown
}

declare module "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator" {
	export const DropIndicator: React.FC
}
