"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

import { cn } from "@/utils/cn"

interface VolunteersLayoutProps {
	children: React.ReactNode
}

const tabs = [
	{ label: "Volunteers", href: "" },
	{ label: "Judge Scheduling", href: "/judges" },
]

export default function VolunteersLayout({ children }: VolunteersLayoutProps) {
	const pathname = usePathname()
	const params = useParams()
	const competitionId = params.competitionId as string
	const basePath = `/compete/organizer/${competitionId}/volunteers`

	return (
		<div className="space-y-6">
			{/* Tabs */}
			<nav className="flex gap-4 border-b">
				{tabs.map((tab) => {
					const href = `${basePath}${tab.href}`
					const isActive =
						tab.href === "" ? pathname === basePath : pathname.startsWith(href)

					return (
						<Link
							key={tab.href}
							href={href}
							className={cn(
								"pb-2 text-sm font-medium transition-colors border-b-2 -mb-px",
								isActive
									? "border-primary text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50",
							)}
						>
							{tab.label}
						</Link>
					)
				})}
			</nav>

			{/* Content */}
			{children}
		</div>
	)
}
