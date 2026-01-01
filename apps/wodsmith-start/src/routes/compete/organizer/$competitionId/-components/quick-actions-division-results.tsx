import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {AlertTriangle, Check, Eye, EyeOff, Loader2, Trophy} from 'lucide-react'
import {useState} from 'react'
import {toast} from 'sonner'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {DivisionResultStatus} from '@/server-fns/division-results-fns'
import {
  publishAllDivisionResultsFn,
  publishDivisionResultsFn,
} from '@/server-fns/division-results-fns'

interface QuickActionsDivisionResultsProps {
  competitionId: string
  organizingTeamId: string
  divisions: DivisionResultStatus[]
  publishedCount: number
  totalCount: number
}

export function QuickActionsDivisionResults({
  competitionId,
  organizingTeamId,
  divisions,
  publishedCount,
  totalCount,
}: QuickActionsDivisionResultsProps) {
  const router = useRouter()
  const [pendingDivisions, setPendingDivisions] = useState<Set<string>>(
    new Set(),
  )
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  // Wrap server functions with useServerFn for client-side calls
  const publishDivisionResults = useServerFn(publishDivisionResultsFn)
  const publishAllDivisionResults = useServerFn(publishAllDivisionResultsFn)

  const handleToggleDivisionResults = async (
    divisionId: string,
    publish: boolean,
  ) => {
    setPendingDivisions((prev) => new Set(prev).add(divisionId))
    try {
      await publishDivisionResults({
        data: {
          competitionId,
          organizingTeamId,
          divisionId,
          publish,
        },
      })
      toast.success(
        publish ? 'Division results published' : 'Division results unpublished',
      )
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update results',
      )
    } finally {
      setPendingDivisions((prev) => {
        const next = new Set(prev)
        next.delete(divisionId)
        return next
      })
    }
  }

  const handlePublishAll = async (publish: boolean) => {
    setIsBulkUpdating(true)
    try {
      const result = await publishAllDivisionResults({
        data: {
          competitionId,
          organizingTeamId,
          publish,
        },
      })
      toast.success(
        publish
          ? `Published results for ${result.updatedCount} divisions`
          : `Unpublished results for ${result.updatedCount} divisions`,
      )
      await router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update all divisions',
      )
    } finally {
      setIsBulkUpdating(false)
    }
  }

  if (divisions.length === 0) {
    return null
  }

  const hasMissingScores = divisions.some((d) => d.missingScoreCount > 0)
  const allPublished = publishedCount === totalCount

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Division Results</CardTitle>
              <CardDescription>
                {publishedCount} of {totalCount} divisions published
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {!allPublished && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handlePublishAll(true)}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-1.5" />
                )}
                Publish All
              </Button>
            )}
            {publishedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePublishAll(false)}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <EyeOff className="h-4 w-4 mr-1.5" />
                )}
                Unpublish All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasMissingScores && (
          <Alert className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              Some divisions have athletes with missing scores. Publishing
              results with incomplete data may show incomplete leaderboards.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {divisions.map((division) => {
            const isPending = pendingDivisions.has(division.divisionId)
            const hasMissing = division.missingScoreCount > 0

            return (
              <div
                key={division.divisionId}
                className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">
                    {division.label}
                  </span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {division.registrationCount} athlete
                    {division.registrationCount !== 1 ? 's' : ''}
                  </Badge>
                  {hasMissing && (
                    <Badge className="text-xs shrink-0 border-amber-500/50 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {division.missingScoreCount} missing
                    </Badge>
                  )}
                  {division.scoredCount === division.registrationCount &&
                    division.registrationCount > 0 && (
                      <Badge className="text-xs shrink-0 border-green-500/50 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={division.isPublished ? 'published' : 'draft'}
                    onValueChange={(value) =>
                      handleToggleDivisionResults(
                        division.divisionId,
                        value === 'published',
                      )
                    }
                    disabled={isPending || isBulkUpdating}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue>
                        {isPending ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Updating...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            {division.isPublished ? (
                              <Eye className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {division.isPublished ? 'Published' : 'Draft'}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        <span className="flex items-center gap-2">
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          Draft
                        </span>
                      </SelectItem>
                      <SelectItem value="published">
                        <span className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-green-600" />
                          Published
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </div>

        {divisions.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Published divisions show results on the public leaderboard. Draft
              divisions are hidden from athletes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
