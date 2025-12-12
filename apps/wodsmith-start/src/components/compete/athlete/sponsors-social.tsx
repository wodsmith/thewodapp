"use client"

interface SponsorsSocialProps {
	sponsors?: Array<{
		name: string
		logo?: string
	}>
	social?: {
		instagram?: string
		twitter?: string
	}
}

export function SponsorsSocial({ sponsors = [], social }: SponsorsSocialProps) {
	return (
		<div className="p-4 space-y-4">
			{sponsors.length > 0 && (
				<div>
					<h3 className="font-semibold mb-2">Sponsors</h3>
					<div className="flex flex-wrap gap-2">
						{sponsors.map((sponsor) => (
							<div
								key={sponsor.name}
								className="px-3 py-1 bg-muted rounded text-sm"
							>
								{sponsor.name}
							</div>
						))}
					</div>
				</div>
			)}
			{social && (social.instagram || social.twitter) && (
				<div>
					<h3 className="font-semibold mb-2">Social</h3>
					<div className="flex gap-2">
						{social.instagram && (
							<a
								href={`https://instagram.com/${social.instagram}`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-primary hover:underline"
							>
								@{social.instagram}
							</a>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
