import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "server-only"

import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import NextTopLoader from "nextjs-toploader"
import { ThemeProvider } from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/constants"

export const dynamic = "force-dynamic"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: {
		default: SITE_NAME,
		template: `%s - ${SITE_NAME}`,
	},
	description: SITE_DESCRIPTION,
	metadataBase: new URL(SITE_URL),
	keywords: [
		"SaaS",
		"Next.js",
		"React",
		"TypeScript",
		"Cloudflare Workers",
		"Edge Computing",
	],
	authors: [{ name: "Lubomir Georgiev" }],
	creator: "Lubomir Georgiev",
	openGraph: {
		type: "website",
		locale: "en_US",
		url: SITE_URL,
		title: SITE_NAME,
		description: SITE_DESCRIPTION,
		siteName: SITE_NAME,
	},
	twitter: {
		card: "summary_large_image",
		title: SITE_NAME,
		description: SITE_DESCRIPTION,
		creator: "@LubomirGeorg",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
}

export default function BaseLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${GeistSans.variable} ${GeistMono.variable}`}
		>
			<body className={inter.className}>
				<NextTopLoader
					initialPosition={0.15}
					shadow="0 0 10px #000, 0 0 5px #000"
					height={4}
					color="#ff7033"
				/>
				<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
					<TooltipProvider delayDuration={100} skipDelayDuration={50}>
						{children}
					</TooltipProvider>
				</ThemeProvider>
				<Toaster
					richColors
					closeButton
					position="top-right"
					expand
					duration={7000}
				/>
			</body>
		</html>
	)
}
