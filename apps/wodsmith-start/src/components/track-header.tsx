'use client'

import {Edit} from 'lucide-react'
import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {TrackVisibilitySelector} from '@/components/track-visibility-selector'
import {ProgrammingTrackEditDialog} from '@/components/programming-track-edit-dialog'
import type {ProgrammingTrackWithOwner} from '@/server-fns/programming-fns'

interface TrackHeaderProps {
  track: ProgrammingTrackWithOwner
  onSuccess?: () => void
}

export function TrackHeader({
  track: initialTrack,
  onSuccess,
}: TrackHeaderProps) {
  const [track, setTrack] = useState(initialTrack)

  const handleVisibilityChange = (isPublic: boolean) => {
    // Update local state when visibility changes
    setTrack((prev) => ({
      ...prev,
      isPublic: isPublic ? 1 : 0,
    }))
  }

  const handleEditSuccess = () => {
    // Trigger parent refresh
    onSuccess?.()
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-2">{track.name}</h1>
        {track.description && (
          <p className="text-muted-foreground mb-2">{track.description}</p>
        )}
        {track.ownerTeam && (
          <p className="text-sm text-muted-foreground">
            Owner: <span className="font-semibold">{track.ownerTeam.name}</span>
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <ProgrammingTrackEditDialog
          track={track}
          trigger={
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Track
            </Button>
          }
          onSuccess={handleEditSuccess}
        />
        <TrackVisibilitySelector
          track={track}
          onVisibilityChange={handleVisibilityChange}
        />
      </div>
    </div>
  )
}
