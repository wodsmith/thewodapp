"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type React from "react"
import { useEffect } from "react"
import { queryClient } from "@/utils/queryClient"
import { useConfigStore } from "@/state/config"
import { useSessionStore } from "@/state/session"
import type { SessionValidationResult } from "@/types"

interface SessionHydrationProps {
	initialSession?: SessionValidationResult
	children: React.ReactNode
}

/**
 * Session hydration component that loads the session data
 * into the Zustand store. For TanStack Start, session data
 * comes from server functions or loader data, not API endpoints.
 */
function SessionHydration({ initialSession, children }: SessionHydrationProps) {
	const setSession = useSessionStore((store) => store.setSession)
	const clearSession = useSessionStore((store) => store.clearSession)

	// Hydrate session on mount
	useEffect(() => {
		if (initialSession) {
			setSession(initialSession)
		} else {
			clearSession()
		}
	}, [initialSession, setSession, clearSession])

	return <>{children}</>
}

interface ProvidersProps {
	children: React.ReactNode
	initialSession?: SessionValidationResult
	isDev?: boolean
}

/**
 * Root providers component that wraps the application with necessary providers.
 * For TanStack Start:
 * - QueryClientProvider for server state management (React Query)
 * - SessionHydration for client session state (Zustand)
 * - NextThemesProvider for theme support
 * - TanStackRouterDevtools for development debugging
 *
 * Note: Unlike Next.js, TanStack Start doesn't need NextJS-specific providers
 * like NuqsAdapter or HeroUIProvider.
 */
export function Providers({
	children,
	initialSession,
	isDev = false,
}: ProvidersProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
				<SessionHydration initialSession={initialSession}>
					{children}
					{isDev && <TanStackRouterDevtools />}
				</SessionHydration>
			</NextThemesProvider>
		</QueryClientProvider>
	)
}
