import React from "react"
import {
	Breadcrumb,
	BreadcrumbItem as BreadcrumbItemComponent,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

interface BreadcrumbItem {
	href: string
	label: string
}

interface PageHeaderProps {
	items: BreadcrumbItem[]
}

export function PageHeader({ items }: PageHeaderProps) {
	return (
		<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
			<div className="flex items-center gap-2 px-4">
				<Separator orientation="vertical" className="mr-2 h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						{items.map((item, index) => (
							<React.Fragment key={item.href}>
								<BreadcrumbItemComponent className="hidden md:block">
									<BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
								</BreadcrumbItemComponent>
								{index < items.length - 1 && (
									<BreadcrumbSeparator className="hidden md:block" />
								)}
							</React.Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		</header>
	)
}
