"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { DivisionCrossoverInterstitial } from "@/components/division-crossover-interstitial"
import { Suspense } from "react"

function CrossoverContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const previousDivision = searchParams.get("prev") || "Unknown"
  const nextDivision = searchParams.get("next") || "Unknown"
  const nextHeatId = searchParams.get("heatId") || ""
  const nextHeatNumber = Number.parseInt(searchParams.get("heatNum") || "1")

  // Mock standards - in real app, fetch from API based on divisions
  const standards = [
    {
      label: "Barbell Weight",
      previous: "135 lbs",
      next: "95 lbs",
      hasChange: true,
    },
    {
      label: "Box Height",
      previous: "24 inches",
      next: "20 inches",
      hasChange: true,
    },
    {
      label: "Time Cap",
      previous: "15:00",
      next: "15:00",
      hasChange: false,
    },
  ]

  const handleContinue = () => {
    router.push(`/heat/${nextHeatId}`)
  }

  return (
    <DivisionCrossoverInterstitial
      previousDivision={previousDivision}
      nextDivision={nextDivision}
      nextHeatNumber={nextHeatNumber}
      standards={standards}
      onContinue={handleContinue}
    />
  )
}

export default function CrossoverPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CrossoverContent />
    </Suspense>
  )
}
