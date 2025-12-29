import { Link } from "@tanstack/react-router"
import { Fragment } from "react"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export interface BreadcrumbSegment {
	label: string
	href?: string
}

interface OrganizerBreadcrumbProps {
	segments: BreadcrumbSegment[]
}

export function OrganizerBreadcrumb({ segments }: OrganizerBreadcrumbProps) {
	const allSegments: BreadcrumbSegment[] = [
		{ label: "Organizer", href: "/compete/organizer" },
		...segments,
	]

	return (
		<Breadcrumb className="mb-4">
			<BreadcrumbList>
				{allSegments.map((segment, index) => {
					const isLast = index === allSegments.length - 1

					return (
						<Fragment key={segment.label}>
							{index > 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{isLast || !segment.href ? (
									<BreadcrumbPage>{segment.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={segment.href}>{segment.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					)
				})}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
