"use client"

import { useRouter } from "@tanstack/react-router"
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	type ReactNode,
} from "react"

import {
	capturePageleave,
	capturePageview,
	getPostHog,
	initPostHog,
	type posthog,
} from "./client"

interface PostHogContextValue {
	posthog: typeof posthog
}

const PostHogContext = createContext<PostHogContextValue | null>(null)

interface PostHogProviderProps {
	children: ReactNode
}

/**
 * PostHog Provider for TanStack Start applications.
 *
 * Handles:
 * - Client-side PostHog initialization
 * - Automatic pageview tracking on route changes
 * - Cleanup on unmount
 *
 * @example
 * ```tsx
 * // In __root.tsx RootDocument
 * <PostHogProvider>
 *   {children}
 * </PostHogProvider>
 * ```
 */
export function PostHogProvider({ children }: PostHogProviderProps) {
	const router = useRouter()
	const previousPathRef = useRef<string>("")

	// Initialize PostHog on mount (client-side only)
	useEffect(() => {
		initPostHog()

		// Capture initial pageview
		capturePageview()

		// Store initial path
		previousPathRef.current = window.location.pathname
	}, [])

	// Track route changes
	useEffect(() => {
		const unsubscribe = router.subscribe("onResolved", (event) => {
			const newPath = event.toLocation.pathname

			// Only capture if path actually changed (avoid duplicate events)
			if (newPath !== previousPathRef.current) {
				capturePageview(event.toLocation.href)
				previousPathRef.current = newPath
			}
		})

		return () => {
			unsubscribe()
		}
	}, [router])

	// Capture page leave on unmount
	useEffect(() => {
		return () => {
			capturePageleave()
		}
	}, [])

	const value = useMemo<PostHogContextValue>(
		() => ({
			posthog: getPostHog(),
		}),
		[],
	)

	return (
		<PostHogContext.Provider value={value}>{children}</PostHogContext.Provider>
	)
}

/**
 * Hook to access the PostHog instance from context.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { posthog } = usePostHog()
 *
 *   const handleClick = () => {
 *     posthog.capture('button_clicked', { button: 'signup' })
 *   }
 *
 *   return <button onClick={handleClick}>Sign Up</button>
 * }
 * ```
 */
export function usePostHog(): PostHogContextValue {
	const context = useContext(PostHogContext)

	if (!context) {
		throw new Error("usePostHog must be used within a PostHogProvider")
	}

	return context
}
