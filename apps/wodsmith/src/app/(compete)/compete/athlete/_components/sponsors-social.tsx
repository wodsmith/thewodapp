import { ExternalLink, Facebook, Instagram, Twitter } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { AthleteProfileData } from "@/utils/athlete-profile"

type SponsorsSocialProps = {
	athleteProfile: AthleteProfileData | null
}

export function SponsorsSocial({ athleteProfile }: SponsorsSocialProps) {
	const social = athleteProfile?.social
	const sponsors = athleteProfile?.sponsors

	const hasSocialLinks =
		social?.facebook || social?.instagram || social?.twitter || social?.tiktok
	const hasSponsors = sponsors && sponsors.length > 0

	return (
		<div className="space-y-6">
			{/* Social Networks */}
			<Card>
				<CardHeader>
					<CardTitle>Social Networks</CardTitle>
					<CardDescription>Connect on social media</CardDescription>
				</CardHeader>
				<CardContent>
					{hasSocialLinks ? (
						<div className="flex flex-wrap gap-3">
							{social?.instagram && (
								<Button asChild variant="outline" size="sm">
									<Link
										href={social.instagram}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Instagram className="mr-2 h-4 w-4" />
										Instagram
									</Link>
								</Button>
							)}
							{social?.facebook && (
								<Button asChild variant="outline" size="sm">
									<Link
										href={social.facebook}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Facebook className="mr-2 h-4 w-4" />
										Facebook
									</Link>
								</Button>
							)}
							{social?.twitter && (
								<Button asChild variant="outline" size="sm">
									<Link
										href={social.twitter}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Twitter className="mr-2 h-4 w-4" />
										Twitter
									</Link>
								</Button>
							)}
							{social?.tiktok && (
								<Button asChild variant="outline" size="sm">
									<Link
										href={social.tiktok}
										target="_blank"
										rel="noopener noreferrer"
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										TikTok
									</Link>
								</Button>
							)}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No social networks added yet
						</p>
					)}
				</CardContent>
			</Card>

			{/* Sponsors */}
			<Card>
				<CardHeader>
					<CardTitle>Sponsors</CardTitle>
					<CardDescription>Supporting brands and partners</CardDescription>
				</CardHeader>
				<CardContent>
					{hasSponsors ? (
						<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
							{sponsors.map((sponsor, index) => (
								<div
									key={index}
									className="border-muted flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
								>
									{sponsor.logoUrl ? (
										<img
											src={sponsor.logoUrl}
											alt={sponsor.name}
											className="h-16 w-auto object-contain"
										/>
									) : (
										<div className="flex h-16 items-center">
											<p className="font-semibold">{sponsor.name}</p>
										</div>
									)}
									{sponsor.website && (
										<Button asChild variant="link" size="sm" className="h-auto p-0">
											<Link
												href={sponsor.website}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs"
											>
												Visit Website
											</Link>
										</Button>
									)}
								</div>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">No sponsors added yet</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
