import type {Workout} from '@/db/schemas/workouts'
import {cn} from '@/utils/cn'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'

// Minimal workout type for display purposes
type WorkoutDisplay = Pick<
  Workout,
  'id' | 'name' | 'description' | 'scheme' | 'scope'
>

interface WorkoutCardProps {
  workout: WorkoutDisplay
  className?: string
}

export function WorkoutCard({workout, className}: WorkoutCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader>
        <CardTitle className="text-xl">{workout.name}</CardTitle>
        {workout.description && (
          <CardDescription className="line-clamp-2">
            {workout.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
            {workout.scheme.toUpperCase()}
          </span>
          {workout.scope && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
              {workout.scope}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
