import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Ledger - Document Viewer" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),

	component: RootComponent,
	shellComponent: RootDocument,
})

function RootComponent() {
	return <Outlet />
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen antialiased">
				{children}
				<Scripts />
			</body>
		</html>
	)
}
