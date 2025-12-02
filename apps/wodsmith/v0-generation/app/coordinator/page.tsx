"use client"

import { useRouter } from "next/navigation"
import { GlobalHeader } from "@/components/global-header"
import { CoordinatorView } from "@/components/coordinator-view"
import type { HeatWithScores } from "@/lib/types"

// Reuse mock data
const mockHeats: HeatWithScores[] = [
  {
    id: "heat-1",
    workoutId: "workout-1",
    heatNumber: 1,
    divisionId: "div-mrx",
    divisionName: "MEN'S RX",
    scheduledStartTime: "2025-11-30T09:00:00",
    status: "complete",
    athletes: Array.from({ length: 10 }, (_, i) => ({
      id: `athlete-${i}`,
      firstName: "John",
      lastName: `Doe ${i}`,
      bibNumber: `${100 + i}`,
      divisionId: "div-mrx",
      lane: i + 1,
      divisionBadge: "RX",
    })),
    isMixed: false,
    nextHeatId: "heat-2",
    previousHeatId: null,
    isDivisionCrossover: false,
    scores: [],
    completedCount: 10,
    totalCount: 10,
  },
  {
    id: "heat-2",
    workoutId: "workout-1",
    heatNumber: 2,
    divisionId: "div-mrx",
    divisionName: "MEN'S RX",
    scheduledStartTime: "2025-11-30T09:15:00",
    status: "scoring",
    athletes: Array.from({ length: 10 }, (_, i) => ({
      id: `athlete-${10 + i}`,
      firstName: "David",
      lastName: `Smith ${i}`,
      bibNumber: `${110 + i}`,
      divisionId: "div-mrx",
      lane: i + 1,
      divisionBadge: "RX",
    })),
    isMixed: false,
    nextHeatId: "heat-3",
    previousHeatId: "heat-1",
    isDivisionCrossover: false,
    scores: [],
    completedCount: 8,
    totalCount: 10,
    lastUpdateBy: "Volunteer A",
    lastUpdateTime: new Date(),
  },
  {
    id: "heat-3",
    workoutId: "workout-1",
    heatNumber: 3,
    divisionId: "div-mrx",
    divisionName: "MEN'S RX",
    scheduledStartTime: "2025-11-30T09:30:00",
    status: "upcoming",
    athletes: Array.from({ length: 10 }, (_, i) => ({
      id: `athlete-${20 + i}`,
      firstName: "Mike",
      lastName: `Johnson ${i}`,
      bibNumber: `${120 + i}`,
      divisionId: "div-mrx",
      lane: i + 1,
      divisionBadge: "RX",
    })),
    isMixed: false,
    nextHeatId: "heat-4",
    previousHeatId: "heat-2",
    isDivisionCrossover: true,
    scores: [],
    completedCount: 0,
    totalCount: 10,
  },
  {
    id: "heat-4",
    workoutId: "workout-1",
    heatNumber: 1,
    divisionId: "div-wrx",
    divisionName: "WOMEN'S RX",
    scheduledStartTime: "2025-11-30T09:45:00",
    status: "upcoming",
    athletes: Array.from({ length: 10 }, (_, i) => ({
      id: `athlete-${30 + i}`,
      firstName: "Sarah",
      lastName: `Williams ${i}`,
      bibNumber: `${130 + i}`,
      divisionId: "div-wrx",
      lane: i + 1,
      divisionBadge: "RX",
    })),
    isMixed: false,
    nextHeatId: null,
    previousHeatId: "heat-3",
    isDivisionCrossover: false,
    scores: [],
    completedCount: 0,
    totalCount: 10,
  },
]

export default function CoordinatorPage() {
  const router = useRouter()

  const handleClose = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader eventName="The Fran-off (2025)" />
      <CoordinatorView heats={mockHeats} onClose={handleClose} />
    </div>
  )
}
