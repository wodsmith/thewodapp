"use client"

import { Link } from "@tanstack/react-router"

interface SettingsBreadcrumbsProps {
	items?: Array<{
		label: string
		href?: string
	}>
}

export function SettingsBreadcrumbs({ items = [] }: SettingsBreadcrumbsProps) {
	return (
		<nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
			<Link to="/settings" className="hover:text-foreground">
				Settings
			</Link>
			{items.map((item, index) => (
				<span key={item.label} className="flex items-center space-x-2">
					<span>/</span>
					{item.href ? (
						<Link to={item.href} className="hover:text-foreground">
							{item.label}
						</Link>
					) : (
						<span className="text-foreground">{item.label}</span>
					)}
				</span>
			))}
		</nav>
	)
}
