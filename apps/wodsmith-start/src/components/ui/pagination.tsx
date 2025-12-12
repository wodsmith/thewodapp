"use client"

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { parseAsInteger, useQueryState } from "nuqs"
import * as React from "react"
import { type ButtonProps, buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
	<nav
		aria-label="pagination"
		className={cn("mx-auto flex w-full justify-center", className)}
		{...props}
	/>
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
	HTMLUListElement,
	React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
	<ul
		ref={ref}
		className={cn("flex flex-row items-center gap-1", className)}
		{...props}
	/>
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
	<li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
	isActive?: boolean
} & Pick<ButtonProps, "size"> &
	React.ComponentProps<"a">

const PaginationLink = ({
	className,
	isActive,
	size = "icon",
	...props
}: PaginationLinkProps) => (
	<a
		aria-current={isActive ? "page" : undefined}
		className={cn(
			buttonVariants({
				variant: isActive ? "outline" : "ghost",
				size,
			}),
			className,
		)}
		{...props}
	/>
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
	className,
	...props
}: React.ComponentProps<typeof PaginationLink>) => (
	<PaginationLink
		aria-label="Go to previous page"
		size="default"
		className={cn("gap-1 pl-2.5", className)}
		{...props}
	>
		<ChevronLeft className="h-4 w-4" />
		<span>Previous</span>
	</PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
	className,
	...props
}: React.ComponentProps<typeof PaginationLink>) => (
	<PaginationLink
		aria-label="Go to next page"
		size="default"
		className={cn("gap-1 pr-2.5", className)}
		{...props}
	>
		<span>Next</span>
		<ChevronRight className="h-4 w-4" />
	</PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
	className,
	...props
}: React.ComponentProps<"span">) => (
	<span
		aria-hidden
		className={cn("flex h-9 w-9 items-center justify-center", className)}
		{...props}
	>
		<MoreHorizontal className="h-4 w-4" />
		<span className="sr-only">More pages</span>
	</span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

interface PaginationCoreProps {
	totalItems: number
	pageSize: number
	currentPage: number
	setCurrentPage: (page: number) => void
	showInfo?: boolean
	className?: string
}

const PaginationCore = ({
	totalItems,
	pageSize,
	currentPage,
	setCurrentPage,
	showInfo = false,
	className,
}: PaginationCoreProps) => {
	const totalPages = Math.ceil(totalItems / pageSize)
	const startItem = (currentPage - 1) * pageSize + 1
	const endItem = Math.min(currentPage * pageSize, totalItems)

	if (totalPages <= 1) return null

	const handlePageClick = (page: number) => (e: React.MouseEvent) => {
		e.preventDefault()
		setCurrentPage(page)
	}

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{showInfo && (
				<div className="text-sm text-muted-foreground text-center md:text-left">
					{totalItems === 0 ? (
						"No items found"
					) : (
						<>
							Showing <span className="font-medium">{startItem}</span>
							{" - "}
							<span className="font-medium">{endItem}</span>
							{" of "}
							<span className="font-medium">{totalItems}</span>
							{" items"}
						</>
					)}
				</div>
			)}
			<Pagination className={className}>
				<PaginationContent>
					{currentPage > 1 && (
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={handlePageClick(currentPage - 1)}
							/>
						</PaginationItem>
					)}

					{/* First page */}
					<PaginationItem>
						<PaginationLink
							href="#"
							onClick={handlePageClick(1)}
							isActive={currentPage === 1}
						>
							1
						</PaginationLink>
					</PaginationItem>

					{/* Ellipsis after first page */}
					{currentPage > 3 && <PaginationEllipsis />}

					{/* Middle pages */}
					{Array.from({ length: totalPages }, (_, i) => i + 1)
						.filter(
							(page) =>
								page !== 1 &&
								page !== totalPages &&
								Math.abs(page - currentPage) <= 1,
						)
						.map((page) => (
							<PaginationItem key={page}>
								<PaginationLink
									href="#"
									onClick={handlePageClick(page)}
									isActive={currentPage === page}
								>
									{page}
								</PaginationLink>
							</PaginationItem>
						))}

					{/* Ellipsis before last page */}
					{currentPage < totalPages - 2 && <PaginationEllipsis />}

					{/* Last page */}
					{totalPages > 1 && (
						<PaginationItem>
							<PaginationLink
								href="#"
								onClick={handlePageClick(totalPages)}
								isActive={currentPage === totalPages}
							>
								{totalPages}
							</PaginationLink>
						</PaginationItem>
					)}

					{currentPage < totalPages && (
						<PaginationItem>
							<PaginationNext
								href="#"
								onClick={handlePageClick(currentPage + 1)}
							/>
						</PaginationItem>
					)}
				</PaginationContent>
			</Pagination>
		</div>
	)
}

interface PaginationWithUrlProps {
	totalItems: number
	pageSize: number
	showInfo?: boolean
	className?: string
	pageParam?: string
}

const PaginationWithUrl = ({
	totalItems,
	pageSize,
	showInfo = false,
	className,
	pageParam = "page",
}: PaginationWithUrlProps) => {
	const [currentPage, setCurrentPage] = useQueryState(
		pageParam,
		parseAsInteger.withDefault(1),
	)

	return (
		<PaginationCore
			totalItems={totalItems}
			pageSize={pageSize}
			currentPage={currentPage}
			setCurrentPage={setCurrentPage}
			showInfo={showInfo}
			className={className}
		/>
	)
}

export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
	PaginationWithUrl,
}
