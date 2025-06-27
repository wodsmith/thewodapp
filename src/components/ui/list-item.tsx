import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"
import type { ReactNode } from "react"

interface ListItemProps {
	/**
	 * Change the default rendered element for the one passed as a child, merging their props and behavior.
	 */
	asChild?: boolean

	/**
	 * Main content area - typically contains the primary information
	 */
	content?: ReactNode

	/**
	 * Actions area - typically contains buttons, links, or interactive elements
	 */
	actions?: ReactNode

	/**
	 * Meta area - typically contains badges, tags, or secondary information
	 */
	meta?: ReactNode

	/**
	 * Additional CSS classes for the container
	 */
	className?: string

	/**
	 * Whether to show the meta area on mobile (hidden by default on small screens)
	 */
	showMetaOnMobile?: boolean

	/**
	 * Custom layout direction
	 */
	direction?: "row" | "column"

	/**
	 * Children to render when using compound component pattern
	 */
	children?: ReactNode
}

export function ListItem({
	asChild = false,
	content,
	actions,
	meta,
	className,
	showMetaOnMobile = false,
	direction = "row",
	children,
	...props
}: ListItemProps) {
	const Comp = asChild ? Slot : "li"

	// If using prop-based approach (content, actions, meta props)
	if (content !== undefined || actions !== undefined || meta !== undefined) {
		return (
			<Comp
				className={cn(
					"flex gap-4 px-4 py-2 transition-colors hover:bg-muted/50",
					direction === "row"
						? "flex-col sm:flex-row sm:items-center"
						: "flex-col",
					className,
				)}
				{...props}
			>
				<div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
					{content}
				</div>

				<div className="flex justify-end gap-4">
					{meta && (
						<div
							className={cn(
								"flex flex-wrap gap-2",
								!showMetaOnMobile && "hidden md:flex",
							)}
						>
							{meta}
						</div>
					)}

					{actions && <div className="flex items-center gap-2">{actions}</div>}
				</div>
			</Comp>
		)
	}

	// If using compound component pattern (children with ListItem.Content, etc.)
	return (
		<Comp
			className={cn(
				"flex gap-4 px-4 py-2 transition-colors hover:bg-muted/50",
				direction === "row"
					? "flex-col sm:flex-row sm:items-center sm:justify-between"
					: "flex-col",
				className,
			)}
			{...props}
		>
			{children}
		</Comp>
	)
}

// Compound component pattern for content slots
interface ListItemContentProps {
	asChild?: boolean
	children: ReactNode
	className?: string
}

function ListItemContent({
	asChild = false,
	children,
	className,
	...props
}: ListItemContentProps) {
	const Comp = asChild ? Slot : ("div" as const)

	return (
		<Comp
			className={cn(
				"flex flex-col items-start gap-2 sm:flex-row sm:items-center",
				className,
			)}
			{...props}
		>
			{children}
		</Comp>
	)
}

interface ListItemActionsProps {
	asChild?: boolean
	children: ReactNode
	className?: string
}

function ListItemActions({
	asChild = false,
	children,
	className,
	...props
}: ListItemActionsProps) {
	const Comp = asChild ? Slot : ("div" as const)

	return (
		<Comp className={cn("flex items-center gap-2", className)} {...props}>
			{children}
		</Comp>
	)
}

interface ListItemMetaProps {
	asChild?: boolean
	children: ReactNode
	className?: string
	showOnMobile?: boolean
}

function ListItemMeta({
	asChild = false,
	children,
	className,
	showOnMobile = false,
	...props
}: ListItemMetaProps) {
	const Comp = asChild ? Slot : ("div" as const)

	return (
		<Comp
			className={cn(
				"flex flex-wrap gap-2",
				!showOnMobile && "hidden md:flex",
				className,
			)}
			{...props}
		>
			{children}
		</Comp>
	)
}

// Attach compound components
ListItem.Content = ListItemContent
ListItem.Actions = ListItemActions
ListItem.Meta = ListItemMeta
