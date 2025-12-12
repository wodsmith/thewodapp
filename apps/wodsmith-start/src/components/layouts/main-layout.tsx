"use client"

interface MainLayoutProps {
	children: React.ReactNode
	className?: string
}

export function MainLayout({ children, className }: MainLayoutProps) {
	return (
		<main className={`container mx-auto px-4 py-8 ${className ?? ""}`}>
			{children}
		</main>
	)
}
