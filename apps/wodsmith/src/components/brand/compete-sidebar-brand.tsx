import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface CompeteSidebarBrandProps {
	className?: string
}

export function CompeteSidebarBrand({ className }: CompeteSidebarBrandProps) {
	return (
		<Link
			href="/compete"
			aria-label="WODsmith Compete"
			className={cn(
				"flex min-w-0 items-center gap-2 rounded-md px-2 py-1 outline-none ring-sidebar-ring focus-visible:ring-2",
				"group-data-[collapsible=icon]:hidden",
				className,
			)}
		>
			<Image
				src="/wodsmith-logo-no-text.png"
				alt=""
				width={28}
				height={28}
				className="size-7 shrink-0"
			/>
			<span className="min-w-0 truncate text-sm text-sidebar-foreground group-data-[collapsible=icon]:hidden">
				<span className="font-black uppercase">wod</span>smith{" "}
				<span className="font-medium text-amber-600 dark:text-amber-500">
					Compete
				</span>
			</span>
			<span className="sr-only">WODsmith Compete</span>
		</Link>
	)
}
