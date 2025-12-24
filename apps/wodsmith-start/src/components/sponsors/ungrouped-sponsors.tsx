'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {Sponsor} from '@/db/schemas/sponsors'
import {SponsorCard} from './sponsor-card'

interface UngroupedSponsorsProps {
  sponsors: Sponsor[]
  onEditSponsor: (sponsor: Sponsor) => void
  onDeleteSponsor: (sponsorId: string) => void
}

export function UngroupedSponsors({
  sponsors,
  onEditSponsor,
  onDeleteSponsor,
}: UngroupedSponsorsProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Ungrouped Sponsors</CardTitle>
        <CardDescription>
          {sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''} without a group
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              onEdit={() => onEditSponsor(sponsor)}
              onDelete={() => onDeleteSponsor(sponsor.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
