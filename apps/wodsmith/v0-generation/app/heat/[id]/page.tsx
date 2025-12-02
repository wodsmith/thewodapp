"use client"

import { useRouter, useParams } from "next/navigation"
import { GlobalHeader } from "@/components/global-header"
import { ActiveHeatView } from "@/components/active-heat-view"
import type { HeatWithScores } from "@/lib/types"

// Mock heat data
const mockHeat: HeatWithScores = {
  id: "heat-2",
  workoutId: "workout-1",
  heatNumber: 2,
  divisionId: "div-mrx",
  divisionName: "MEN'S RX",
  scheduledStartTime: "2025-11-30T09:15:00",
  status: "scoring",
  athletes: Array.from({ length: 10 }, (_, i) => ({
    id: `athlete-${10 + i}`,
    firstName: ["John", "David", "Alex", "Michael", "Brian", "Tom", "Chris", "Steve", "Mark", "Paul"][i],
    lastName: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Martinez", "Lopez"][i],
    bibNumber: `${110 + i}`,
    divisionId: "div-mrx",
    lane: i + 1,
    divisionBadge: "RX",
  })),
  isMixed: false,
  nextHeatId: "heat-3",
  previousHeatId: "heat-1",
  isDivisionCrossover: true,
  scores: [],
  completedCount: 0,
  totalCount: 10,
}

// Mock next heat info
const mockNextHeat = {
  id: "heat-3",
  divisionName: "WOMEN'S SCALED",
  heatNumber: 1,
}

export default function HeatPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const handleBack = () => {
    router.push("/")
  }

  const handleComplete = () => {
    if (mockHeat.isDivisionCrossover) {
      const crossoverUrl = `/crossover?prev=${encodeURIComponent(mockHeat.divisionName)}&next=${encodeURIComponent(
        mockNextHeat.divisionName,
      )}&heatId=${mockNextHeat.id}&heatNum=${mockNextHeat.heatNumber}`
      router.push(crossoverUrl)
    } else {
      router.push(`/heat/${mockHeat.nextHeatId}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader eventName="The Fran-off (2025)" />
      <ActiveHeatView heat={mockHeat} onBack={handleBack} onComplete={handleComplete} />
    </div>
  )
}
