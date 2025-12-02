// Core domain types for competition scoring system

export type WorkoutType = "for-time" | "amrap" | "max-load"
export type HeatStatus = "upcoming" | "active" | "scoring" | "complete"
export type ScoreStatus = "pending" | "saved" | "synced" | "error"

export interface Division {
  id: string
  name: string
  displayName: string
  badge: string // Short label like "RX", "SC", "M45"
  color: string // For visual grouping in mixed heats
}

export interface Workout {
  id: string
  name: string
  type: WorkoutType
  timeCap: number // seconds
  repScheme?: string // e.g., "21-15-9" or "AMRAP"
  standards: {
    [divisionId: string]: {
      timeCap: number
      load?: number // lbs or kg
      height?: number // box height, wall ball target, etc.
      description?: string
    }
  }
}

export interface Athlete {
  id: string
  firstName: string
  lastName: string
  bibNumber: string
  divisionId: string
}

export interface AthleteInHeat extends Athlete {
  lane: number
  divisionBadge: string
}

export interface Score {
  athleteId: string
  heatId: string
  value: string // raw input: "1234", "cap", "dns", "dnf"
  parsedValue: string // formatted: "12:34", "CAP (15:00)", "DNS"
  tieBreak?: string // reps completed or time for tie-break
  status: ScoreStatus
  rank?: number
  warning?: string // outlier detection message
  lastModified: Date
  modifiedBy: string
}

export interface Heat {
  id: string
  workoutId: string
  heatNumber: number
  divisionId: string
  divisionName: string
  scheduledStartTime: string
  status: HeatStatus
  athletes: AthleteInHeat[]
  isMixed: boolean
  standardsConfig?: {
    [divisionId: string]: {
      timeCap: number
      load?: number
    }
  }
  nextHeatId: string | null
  previousHeatId: string | null
  isDivisionCrossover: boolean
}

export interface HeatWithScores extends Heat {
  scores: Score[]
  completedCount: number
  totalCount: number
  lastUpdateBy?: string
  lastUpdateTime?: Date
}

export interface SyncQueueItem {
  id: string
  score: Score
  timestamp: Date
  retryCount: number
}
