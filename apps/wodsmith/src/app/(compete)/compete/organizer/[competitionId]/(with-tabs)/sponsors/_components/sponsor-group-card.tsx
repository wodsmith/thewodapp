"use client"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Sponsor, SponsorGroup } from "@/db/schema"
import { SponsorCard } from "./sponsor-card"

interface SponsorGroupCardProps {
	group: SponsorGroup
	sponsors: Sponsor[]
	onEditGroup: () => void
	onDeleteGroup: () => void
	onAddSponsor: () => void
	onEditSponsor: (sponsor: Sponsor) => void
	onDeleteSponsor: (sponsorId: string) => void
}

export function SponsorGroupCard({
	group,
	sponsors,
	onEditGroup,
	onDeleteGroup,
	onAddSponsor,
	onEditSponsor,
	onDeleteSponsor,
}: SponsorGroupCardProps) {
	const isSingleSponsor = sponsors.length === 1

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<div>
					<CardTitle className="text-lg">{group.name}</CardTitle>
					<CardDescription>
						{sponsors.length} sponsor{sponsors.length !== 1 ? "s" : ""}
						{isSingleSponsor && " (Featured)"}
					</CardDescription>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={onAddSponsor}>
						<Plus className="mr-2 h-4 w-4" />
						Add Sponsor
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<MoreHorizontal className="h-4 w-4" />
								<span className="sr-only">Group actions</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onEditGroup}>
								<Pencil className="mr-2 h-4 w-4" />
								Edit Group
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onDeleteGroup}
								className="text-destructive"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete Group
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>
			<CardContent>
				{sponsors.length === 0 ? (
					<p className="text-muted-foreground py-4 text-center text-sm">
						No sponsors in this group yet
					</p>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{sponsors.map((sponsor) => (
							<SponsorCard
								key={sponsor.id}
								sponsor={sponsor}
								featured={isSingleSponsor}
								onEdit={() => onEditSponsor(sponsor)}
								onDelete={() => onDeleteSponsor(sponsor.id)}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
