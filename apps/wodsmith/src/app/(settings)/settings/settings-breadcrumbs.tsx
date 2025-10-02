"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { capitalize } from "@/utils/text"

export function SettingsBreadcrumbs() {
	const segment = useSelectedLayoutSegment()
	const pageTitle = segment
		? capitalize(segment.replace(/-/g, " "))
		: "Overview"

	return (
		<Breadcrumb className="hidden md:block">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
				</BreadcrumbItem>
				{segment && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{pageTitle}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
