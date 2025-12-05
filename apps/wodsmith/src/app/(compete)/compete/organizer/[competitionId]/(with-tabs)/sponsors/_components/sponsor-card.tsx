"use client"

import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Sponsor } from "@/db/schema"
import { cn } from "@/lib/utils"

interface SponsorCardProps {
	sponsor: Sponsor
	featured?: boolean
	onEdit: () => void
	onDelete: () => void
}

export function SponsorCard({
	sponsor,
	featured,
	onEdit,
	onDelete,
}: SponsorCardProps) {
	return (
		<div
			className={cn(
				"group relative flex flex-col items-center rounded-lg border p-4 transition-colors hover:bg-muted/50",
				featured && "border-primary bg-primary/5",
			)}
		>
			{/* Actions menu */}
			<div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Sponsor actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onDelete} className="text-destructive">
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Logo or name */}
			{sponsor.logoUrl ? (
				<div className="flex h-20 w-full items-center justify-center">
					<Image
						src={sponsor.logoUrl}
						alt={sponsor.name}
						width={160}
						height={80}
						className="max-h-20 w-auto object-contain"
					/>
				</div>
			) : (
				<div className="flex h-20 items-center justify-center">
					<p className="text-center font-semibold">{sponsor.name}</p>
				</div>
			)}

			{/* Name (shown below logo) */}
			{sponsor.logoUrl && (
				<p className="mt-2 text-center text-sm text-muted-foreground">
					{sponsor.name}
				</p>
			)}

			{/* Website link */}
			{sponsor.website && (
				<Button asChild variant="link" size="sm" className="mt-2 h-auto p-0">
					<Link
						href={sponsor.website}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs"
					>
						<ExternalLink className="mr-1 h-3 w-3" />
						Website
					</Link>
				</Button>
			)}

			{/* Featured badge */}
			{featured && (
				<span className="mt-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
					Featured
				</span>
			)}
		</div>
	)
}
