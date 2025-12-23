'use client'

import {useState, useEffect} from 'react'
import {BarChart3} from 'lucide-react'
import {getLeaderboardDataFn} from '@/server-fns/leaderboard-fns'
import {
  getPublicCompetitionDivisionsFn,
  type PublicCompetitionDivision,
} from '@/server-fns/competition-divisions-fns'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface LeaderboardPageContentProps {
  competitionId: string
}

export function LeaderboardPageContent({
  competitionId,
}: LeaderboardPageContentProps) {
  const [divisions, setDivisions] = useState<PublicCompetitionDivision[]>([])
  const [selectedDivision, setSelectedDivision] = useState('')
  const [leaderboardData, setLeaderboardData] = useState<{
    leaderboard: any[]
    workouts: any[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDivisionsLoading, setIsDivisionsLoading] = useState(true)

  // Fetch divisions on mount
  useEffect(() => {
    async function fetchDivisions() {
      setIsDivisionsLoading(true)
      try {
        const result = await getPublicCompetitionDivisionsFn({
          data: {competitionId},
        })
        setDivisions(result.divisions)
        // Set default division to first one
        if (result.divisions.length > 0) {
          setSelectedDivision(result.divisions[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch divisions:', error)
      } finally {
        setIsDivisionsLoading(false)
      }
    }
    fetchDivisions()
  }, [competitionId])

  // Fetch leaderboard when division changes
  useEffect(() => {
    async function fetchLeaderboard() {
      if (!selectedDivision) return

      setIsLoading(true)
      try {
        const result = await getLeaderboardDataFn({
          data: {
            competitionId,
            divisionId: selectedDivision,
          },
        })
        setLeaderboardData(result)
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [competitionId, selectedDivision])

  const handleDivisionChange = (divisionId: string) => {
    setSelectedDivision(divisionId)
  }

  const hasResults = leaderboardData && leaderboardData.leaderboard.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Leaderboard</h2>

        {/* Division selector */}
        {divisions && divisions.length > 1 && (
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={selectedDivision}
              onValueChange={handleDivisionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Loading state */}
      {(isLoading || isDivisionsLoading) && (
        <div className="rounded-md border p-8">
          <div className="text-center text-muted-foreground">
            {isDivisionsLoading
              ? 'Loading divisions...'
              : 'Loading leaderboard...'}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasResults && (
        <Alert variant="default" className="border-dashed">
          <BarChart3 className="h-4 w-4" />
          <AlertTitle>Leaderboard not yet available</AlertTitle>
          <AlertDescription>
            Results and rankings will appear here once athletes start submitting
            scores.
          </AlertDescription>
        </Alert>
      )}

      {/* Leaderboard table */}
      {!isLoading && hasResults && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Athlete</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardData.leaderboard.map((entry, index) => (
                <TableRow key={entry.userId}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{entry.userName}</TableCell>
                  <TableCell>{entry.scalingLevelLabel || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.formattedScore}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Workouts info - if available */}
      {!isLoading &&
        hasResults &&
        leaderboardData.workouts &&
        leaderboardData.workouts.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Competition Workouts ({leaderboardData.workouts.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {leaderboardData.workouts.map((workout) => (
                <div
                  key={workout.id}
                  className="text-xs px-2 py-1 rounded-md bg-muted"
                >
                  {workout.name}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
