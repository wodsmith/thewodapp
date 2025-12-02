"use client"

import { useRouter } from "next/navigation"
import { GlobalHeader } from "@/components/global-header"
import { ActiveHeatView } from "@/components/active-heat-view"
import type { HeatWithScores } from "@/lib/types"

const mockMixedHeat: HeatWithScores = {
  id: "heat-mixed-1",
  workoutId: "workout-1",
  heatNumber: 10,
  divisionId: "mixed",
  divisionName: "Mixed Heat (Transition)",
  scheduledStartTime: "2025-11-30T10:30:00",
  status: "active",
  isMixed: true,
  standardsConfig: {
    "div-mrx": {
      timeCap: 900, // 15:00
      load: 135,
    },
    "div-scaled": {
      timeCap: 720, // 12:00
      load: 95,
    },
  },
  athletes: [
    // Men's Rx (lanes 1-3)
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `athlete-rx-${i}`,
      firstName: "John",
      lastName: `Smith ${i}`,
      bibNumber: `${200 + i}`,
      divisionId: "div-mrx",
      divisionBadge: "RX",
      lane: i + 1,
    })),
    // Men's Scaled (lanes 4-6)
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `athlete-sc-${i}`,
      firstName: "Mike",
      lastName: `Johnson ${i}`,
      bibNumber: `${210 + i}`,
      divisionId: "div-scaled",
      divisionBadge: "SC",
      lane: i + 4,
    })),
  ],
  nextHeatId: "heat-4",
  previousHeatId: "heat-2",
  isDivisionCrossover: false,
  scores: [],
  completedCount: 0,
  totalCount: 6,
}

export default function MixedHeatPage() {
  const router = useRouter()

  const handleBack = () => {
    router.push("/")
  }

  const handleComplete = () => {
    console.log("[v0] Mixed heat completed")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader eventName="The Fran-off (2025)" />
      <ActiveHeatView heat={mockMixedHeat} onBack={handleBack} onComplete={handleComplete} />
    </div>
  )
}
