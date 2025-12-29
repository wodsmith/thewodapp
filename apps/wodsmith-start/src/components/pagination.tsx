import {Link} from '@tanstack/react-router'
import {ChevronLeft, ChevronRight} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {cn} from '@/utils/cn'

export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of items */
  totalCount: number
  /** Number of items per page */
  pageSize: number
  /** Base path for navigation (e.g., "/workouts") */
  basePath: string
  /** Callback to build search params for a given page */
  buildSearchParams: (page: number) => Record<string, unknown>
  /** Optional className for the container */
  className?: string
}

/**
 * Generate an array of page numbers with ellipsis for large page counts
 * Shows: first page, pages around current, last page with ellipsis as needed
 */
type PageItem =
  | {type: 'page'; page: number}
  | {type: 'ellipsis'; position: 'start' | 'end'}

/**
 * Generate an array of page items with ellipsis for large page counts
 * Shows: first page, pages around current, last page with ellipsis as needed
 */
function generatePageItems(
  currentPage: number,
  totalPages: number,
): PageItem[] {
  if (totalPages <= 7) {
    // Show all pages if 7 or less
    return Array.from({length: totalPages}, (_, i) => ({
      type: 'page' as const,
      page: i + 1,
    }))
  }

  const pages: PageItem[] = []

  // Always show first page
  pages.push({type: 'page', page: 1})

  // Determine the range around current page
  const rangeStart = Math.max(2, currentPage - 1)
  const rangeEnd = Math.min(totalPages - 1, currentPage + 1)

  // Add ellipsis after first page if there's a gap
  if (rangeStart > 2) {
    pages.push({type: 'ellipsis', position: 'start'})
  }

  // Add pages in the middle range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push({type: 'page', page: i})
  }

  // Add ellipsis before last page if there's a gap
  if (rangeEnd < totalPages - 1) {
    pages.push({type: 'ellipsis', position: 'end'})
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push({type: 'page', page: totalPages})
  }

  return pages
}

/**
 * Reusable pagination component with URL-based navigation
 * Features:
 * - Page numbers with ellipsis for large page counts
 * - Previous/Next buttons
 * - "Page X of Y" info
 * - URL-based navigation using TanStack Router
 */
export function Pagination({
  currentPage,
  totalCount,
  pageSize,
  basePath,
  buildSearchParams,
  className,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize)

  // Don't render if there's only one page or no items
  if (totalPages <= 1) {
    return null
  }

  const hasPreviousPage = currentPage > 1
  const hasNextPage = currentPage < totalPages
  const pageItems = generatePageItems(currentPage, totalPages)

  // Calculate item range being displayed
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  return (
    <nav
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4',
        className,
      )}
      aria-label="Pagination"
    >
      {/* Page info */}
      <p className="text-sm text-muted-foreground order-2 sm:order-1">
        Showing {startItem} to {endItem} of {totalCount} workouts
      </p>

      {/* Page navigation */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPreviousPage}
          asChild={hasPreviousPage}
          className="gap-1"
        >
          {hasPreviousPage ? (
            <Link
              to={basePath}
              search={buildSearchParams(currentPage - 1)}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Link>
          ) : (
            <span>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </span>
          )}
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageItems.map((item) =>
            item.type === 'ellipsis' ? (
              <span
                key={`ellipsis-${item.position}`}
                className="px-2 text-muted-foreground"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <Button
                key={item.page}
                variant={item.page === currentPage ? 'default' : 'outline'}
                size="sm"
                asChild={item.page !== currentPage}
                aria-label={`Page ${item.page}`}
                aria-current={item.page === currentPage ? 'page' : undefined}
              >
                {item.page === currentPage ? (
                  <span>{item.page}</span>
                ) : (
                  <Link to={basePath} search={buildSearchParams(item.page)}>
                    {item.page}
                  </Link>
                )}
              </Button>
            ),
          )}
        </div>

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
          asChild={hasNextPage}
          className="gap-1"
        >
          {hasNextPage ? (
            <Link
              to={basePath}
              search={buildSearchParams(currentPage + 1)}
              aria-label="Go to next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span>
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </nav>
  )
}
