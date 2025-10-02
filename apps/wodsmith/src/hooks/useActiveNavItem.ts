import { useMemo } from "react"

interface NavItem {
	href: string
}

/**
 * Custom hook to determine which navigation item is active based on the current pathname
 * @param pathname - Current pathname from usePathname()
 * @param navItems - Array of navigation items with href property
 * @returns Function that takes a nav item and returns whether it's active
 */
export function useActiveNavItem<T extends NavItem>(
	pathname: string,
	navItems: T[],
) {
	return useMemo(() => {
		// Normalize pathname by removing trailing slash
		const normalizedPathname = pathname.replace(/\/$/, "")

		// Create a map of normalized hrefs to check for more specific matches
		const normalizedItems = navItems.map((item) => ({
			...item,
			normalizedHref: item.href.replace(/\/$/, ""),
		}))

		return (item: T): boolean => {
			const normalizedHref = item.href.replace(/\/$/, "")

			// Check if there's a more specific route that matches the current path
			const hasMoreSpecificMatch = normalizedItems.some((otherItem) => {
				return (
					otherItem.normalizedHref !== normalizedHref && // Different route
					otherItem.normalizedHref.length > normalizedHref.length && // More specific (longer)
					normalizedPathname.startsWith(otherItem.normalizedHref) // Current path matches the longer route
				)
			})

			// Only mark as active if it matches and there's no more specific match
			return (
				!hasMoreSpecificMatch &&
				(normalizedPathname === normalizedHref ||
					normalizedPathname.startsWith(`${normalizedHref}/`))
			)
		}
	}, [pathname, navItems])
}
