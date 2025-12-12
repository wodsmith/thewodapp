"use client"

interface CompetitionSectionProps {
	title: string
	children: React.ReactNode
	className?: string
}

export function CompetitionSection({
	title,
	children,
	className,
}: CompetitionSectionProps) {
	return (
		<section className={className}>
			<h2 className="text-xl font-semibold mb-4">{title}</h2>
			{children}
		</section>
	)
}
