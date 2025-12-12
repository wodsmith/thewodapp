/**
 * Link component wrapper for TanStack Router
 * Provides compatibility with Next.js Link API
 */
import { Link as RouterLink, type LinkProps } from "@tanstack/react-router"
import { forwardRef } from "react"

interface CustomLinkProps extends Omit<LinkProps, "to"> {
	href: string
	children?: React.ReactNode
	className?: string
}

const Link = forwardRef<HTMLAnchorElement, CustomLinkProps>(
	({ href, children, ...props }, ref) => {
		return (
			<RouterLink ref={ref} to={href} {...props}>
				{children}
			</RouterLink>
		)
	},
)

Link.displayName = "Link"

export default Link
