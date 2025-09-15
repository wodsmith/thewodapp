"use client"

import { Suspense } from "react"
import { NuqsAdapter } from "nuqs/adapters/next/app"

export default function ProgrammingLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<NuqsAdapter>{children}</NuqsAdapter>
		</Suspense>
	)
}
