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
import { getOptionalSession } from "@/server-fns/middleware/auth"

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
		return { session }
	},

	component: RootComponent,
	shellComponent: RootDocument,
	notFoundComponent: NotFoundComponent,
})

function RootComponent() {
	const { session } = Route.useRouteContext()
	const location = useLocation()

	// Don't render MainNav on compete routes - they have their own CompeteNav
	const isCompeteRoute = location.pathname.startsWith("/compete")

	return (
		<>
			{!isCompeteRoute && <MainNav session={session} />}
			<Outlet />
		</>
	)
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
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
