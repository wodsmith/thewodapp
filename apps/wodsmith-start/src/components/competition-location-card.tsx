import type { Address } from "@/types/address"
import { formatFullAddress, hasAddressData } from "@/utils/address"
import { GlobeIcon, InfoIcon, MapPinIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CompetitionLocationCardProps {
	address: Partial<Address> | null
	competitionType: "in-person" | "online"
	organizingTeamName?: string | null
}

export function CompetitionLocationCard({
	address,
	competitionType,
	organizingTeamName,
}: CompetitionLocationCardProps) {
	const isOnline = competitionType === "online"
	const hasAddress = hasAddressData(address)

	return (
		<Card className="border-white/10 bg-white/5 backdrop-blur-md">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{isOnline ? (
						<>
							<GlobeIcon className="h-5 w-5" />
							Location
						</>
					) : (
						<>
							<MapPinIcon className="h-5 w-5" />
							Location
						</>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{isOnline ? (
					<p className="text-muted-foreground">
						This is an online competition. No physical location required.
					</p>
				) : hasAddress ? (
					<div className="whitespace-pre-line">
						{formatFullAddress(address)}
					</div>
				) : (
					<p className="text-muted-foreground">
						{organizingTeamName
							? `Hosted by ${organizingTeamName}`
							: "Location to be announced"}
					</p>
				)}

				{address?.notes && (
					<div className="rounded-md bg-white/5 p-4">
						<div className="flex gap-2">
							<InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
							<p className="text-sm text-muted-foreground">{address.notes}</p>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
