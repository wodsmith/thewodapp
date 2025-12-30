interface VolunteersLayoutProps {
	children: React.ReactNode
}

/**
 * Simple pass-through layout for volunteers section.
 * All content is now rendered in a single scrollable page.
 */
export default function VolunteersLayout({ children }: VolunteersLayoutProps) {
	return <div className="space-y-8">{children}</div>
}
