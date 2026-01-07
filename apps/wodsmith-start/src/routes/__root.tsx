import { TanStackDevtools } from "@tanstack/react-devtools"
import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { Toaster } from "sonner"

import MainNav from "@/components/nav/main-nav"
import { PostHogProvider } from "@/lib/posthog/provider"
import { getOptionalSession } from "@/server-fns/middleware/auth"
import { getActiveTeamIdFn, getThemeCookieFn } from "@/server-fns/session-fns"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "wodsmith",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	beforeLoad: async () => {
		const session = await getOptionalSession()
		// Read theme cookie for SSR - apply 'dark' class on server if theme is 'dark'
		// For 'system' or no cookie, default to light (inline script handles client correction)
		const themeCookie = await getThemeCookieFn()
		const ssrTheme = themeCookie === "dark" ? "dark" : "light"
		// Get active team ID from cookie for team switcher
		const activeTeamId = await getActiveTeamIdFn()
		return { session, ssrTheme, activeTeamId }
	},

	component: RootComponent,
	shellComponent: RootDocument,
	notFoundComponent: NotFoundComponent,
})

function RootComponent() {
	const { session, activeTeamId } = Route.useRouteContext()
	const location = useLocation()

	// Don't render MainNav on routes that have their own navigation
	const isCompeteRoute = location.pathname.startsWith("/compete")
	const isAdminRoute = location.pathname.startsWith("/admin")

	return (
		<>
			{!isCompeteRoute && !isAdminRoute && (
				<MainNav session={session} activeTeamId={activeTeamId} />
			)}
			<Outlet />
		</>
	)
}

/**
 * Blocking script to prevent FOUC - runs before React hydrates.
 *
 * SSR applies 'dark' class based on cookie value (only for explicit 'dark' preference).
 * This script handles:
 * 1. 'system' preference - reads matchMedia to determine if dark mode
 * 2. First visit with no preference - respects OS setting
 * 3. Corrects any mismatch between SSR guess and actual preference
 */
const themeScript = `
try {
  const stored = localStorage.getItem('theme');
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = stored === 'dark' || (stored === 'system' && prefersDark) || (!stored && prefersDark);
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  
  // Correct the class if SSR guess was wrong
  if (shouldBeDark && !isDark) {
    html.classList.add('dark');
  } else if (!shouldBeDark && isDark) {
    html.classList.remove('dark');
  }
} catch {}
`

function RootDocument({ children }: { children: React.ReactNode }) {
	const { ssrTheme } = Route.useRouteContext()

	return (
		<html lang="en" className={ssrTheme === "dark" ? "dark" : undefined}>
			<head>
				{/* Blocking script to prevent FOUC - runs before React hydrates.
			    This corrects for 'system' preference which SSR can't detect.
			    Safe: themeScript is a static string literal, not user input. */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Static theme script, no XSS risk */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				<HeadContent />
			</head>
			<body>
				<PostHogProvider>{children}</PostHogProvider>
				<Toaster richColors position="top-right" />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	)
}

function NotFoundComponent() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-4xl font-bold">404</h1>
			<p className="text-lg text-muted-foreground">Page not found</p>
			<Link
				to="/"
				className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>
				Go Home
			</Link>
		</div>
	)
}
