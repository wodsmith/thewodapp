'use client'

import {Loader2} from 'lucide-react'
import {useEffect, useState} from 'react'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {cn} from '@/lib/utils'
import {
  getWorkoutLeaderboardFn,
  type LeaderboardEntry,
  type WorkoutInstanceLeaderboard,
} from '@/server-fns/workout-leaderboard-fns'

interface WorkoutLeaderboardProps {
  workoutId: string
  teamId: string
  /** Optional: current user ID to highlight their score */
  currentUserId?: string
}

/**
 * Formats a date for display in the leaderboard header
 */
function formatInstanceDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * WorkoutLeaderboard component
 *
 * Displays leaderboards for all scheduled instances of a workout.
 * Groups scores by date and shows rankings for each instance.
 */
export function WorkoutLeaderboard({
  workoutId,
  teamId,
  currentUserId,
}: WorkoutLeaderboardProps) {
  const [leaderboards, setLeaderboards] = useState<
    WorkoutInstanceLeaderboard[]
  >([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      setIsLoading(true)
      try {
        const result = await getWorkoutLeaderboardFn({
          data: {workoutId, teamId},
        })
        setLeaderboards(result.leaderboards)
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLeaderboard()
  }, [workoutId, teamId])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (leaderboards.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No scores have been logged for this workout yet.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {leaderboards.map((leaderboard: WorkoutInstanceLeaderboard) => (
        <WorkoutInstanceLeaderboardCard
          key={leaderboard.instanceId}
          leaderboard={leaderboard}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

interface WorkoutInstanceLeaderboardCardProps {
  leaderboard: WorkoutInstanceLeaderboard
  currentUserId?: string
}

function WorkoutInstanceLeaderboardCard({
  leaderboard,
  currentUserId,
}: WorkoutInstanceLeaderboardCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {formatInstanceDate(leaderboard.instanceDate)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <WorkoutLeaderboardTable
          entries={leaderboard.entries}
          currentUserId={currentUserId}
        />
      </CardContent>
    </Card>
  )
}

interface WorkoutLeaderboardTableProps {
  entries: LeaderboardEntry[]
  currentUserId?: string
}

/**
 * Leaderboard table with current user highlighting.
 * Based on DailyLeaderboard pattern but adds user highlighting.
 */
function WorkoutLeaderboardTable({
  entries,
  currentUserId,
}: WorkoutLeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No results yet for this workout.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Athlete</TableHead>
            <TableHead>Scaling</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isCurrentUser = entry.userId === currentUserId
            const initials = entry.userName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()

            return (
              <TableRow
                key={entry.userId}
                className={cn(isCurrentUser && 'bg-accent/50')}
              >
                <TableCell className="font-semibold">{entry.rank}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'font-medium',
                        isCurrentUser && 'font-bold',
                      )}
                    >
                      {entry.userName}
                      {isCurrentUser && ' (You)'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {entry.scalingLabel ? (
                    <Badge variant={entry.asRx ? 'default' : 'secondary'}>
                      {entry.scalingLabel}
                      {!entry.asRx && ' (Scaled)'}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {entry.displayScore}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * WorkoutLeaderboardSection
 *
 * A section wrapper for the workout leaderboard that can be used
 * in the workout detail page. Export this for use in page components.
 */
export function WorkoutLeaderboardSection({
  workoutId,
  teamId,
}: {
  workoutId: string
  teamId: string
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Team Leaderboard</h2>
      <WorkoutLeaderboard workoutId={workoutId} teamId={teamId} />
    </section>
  )
}
