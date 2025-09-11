"use client"

import { cn } from "@/utils/cn"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { parseAsInteger, useQueryState } from "nuqs"
import { Button } from "@/components/ui/button"

export interface PaginationProps {
	totalItems: number
	currentPage: number
	pageSize: number
	onPageChange?: (page: number) => void
	showInfo?: boolean
	className?: string
}

export interface PaginationWithUrlProps
	extends Omit<PaginationProps, "currentPage" | "onPageChange"> {
	pageParam?: string
}

function PaginationCore({
	totalItems,
	currentPage,
	pageSize,
	onPageChange,
	showInfo = true,
	className,
}: PaginationProps) {
	const totalPages = Math.ceil(totalItems / pageSize)
	const startItem = (currentPage - 1) * pageSize + 1
	const endItem = Math.min(currentPage * pageSize, totalItems)

	const hasPrevious = currentPage > 1
	const hasNext = currentPage < totalPages

	// Generate page numbers to display
	const getPageNumbers = () => {
		const delta = 2 // Number of pages to show on each side of current page
		const pages: (number | string)[] = []

		if (totalPages <= 7) {
			// Show all pages if total is small
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i)
			}
		} else {
			// Always show first page
			pages.push(1)

			const start = Math.max(2, currentPage - delta)
			const end = Math.min(totalPages - 1, currentPage + delta)

			// Add ellipsis after first page if needed
			if (start > 2) {
				pages.push("...")
			}

			// Add pages around current page
			for (let i = start; i <= end; i++) {
				pages.push(i)
			}

			// Add ellipsis before last page if needed
			if (end < totalPages - 1) {
				pages.push("...")
			}

			// Always show last page
			if (totalPages > 1) {
				pages.push(totalPages)
			}
		}

		return pages
	}

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			onPageChange?.(page)
		}
	}

	if (totalItems === 0) {
		return null
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

			<nav
				aria-label="Pagination"
				className="flex items-center justify-center gap-1"
			>
				{/* Previous button */}
				<Button
					variant="outline"
					size="sm"
					onClick={() => handlePageChange(currentPage - 1)}
					disabled={!hasPrevious}
					aria-label="Go to previous page"
					className="h-9 w-9 p-0 md:h-10 md:w-auto md:px-3"
				>
					<ChevronLeft className="h-4 w-4" />
					<span className="hidden md:inline-block ml-2">Previous</span>
				</Button>

				{/* Page numbers */}
				<div className="flex items-center gap-1">
					{getPageNumbers().map((page, index) => {
						if (page === "...") {
							// Use position-based key for ellipsis
							const position =
								index < getPageNumbers().length / 2 ? "start" : "end"
							return (
								<div
									key={`ellipsis-${position}`}
									className="flex h-9 w-9 items-center justify-center md:h-10"
									aria-hidden="true"
								>
									<MoreHorizontal className="h-4 w-4" />
								</div>
							)
						}

						const pageNumber = page as number
						const isCurrentPage = pageNumber === currentPage

						return (
							<Button
								key={pageNumber}
								variant={isCurrentPage ? "default" : "outline"}
								size="sm"
								onClick={() => handlePageChange(pageNumber)}
								aria-label={
									isCurrentPage
										? `Current page ${pageNumber}`
										: `Go to page ${pageNumber}`
								}
								aria-current={isCurrentPage ? "page" : undefined}
								className="h-9 w-9 p-0 md:h-10"
							>
								{pageNumber}
							</Button>
						)
					})}
				</div>

				{/* Next button */}
				<Button
					variant="outline"
					size="sm"
					onClick={() => handlePageChange(currentPage + 1)}
					disabled={!hasNext}
					aria-label="Go to next page"
					className="h-9 w-9 p-0 md:h-10 md:w-auto md:px-3"
				>
					<span className="hidden md:inline-block mr-2">Next</span>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</nav>
		</div>
	)
}

// Version with URL state management using NUQS
export function PaginationWithUrl({
	pageParam = "page",
	...props
}: PaginationWithUrlProps) {
	const [currentPage, setCurrentPage] = useQueryState(
		pageParam,
		parseAsInteger.withDefault(1),
	)

	return (
		<PaginationCore
			{...props}
			currentPage={currentPage}
			onPageChange={setCurrentPage}
		/>
	)
}

// Version with controlled state
export function Pagination(props: PaginationProps) {
	return <PaginationCore {...props} />
}
