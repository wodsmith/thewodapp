"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DivisionCrossoverInterstitialProps {
  previousDivision: string
  nextDivision: string
  nextHeatNumber: number
  standards?: {
    label: string
    previous: string
    next: string
    hasChange: boolean
  }[]
  onContinue: () => void
}

export function DivisionCrossoverInterstitial({
  previousDivision,
  nextDivision,
  nextHeatNumber,
  standards = [],
  onContinue,
}: DivisionCrossoverInterstitialProps) {
  const [canContinue, setCanContinue] = useState(false)
  const [countdown, setCountdown] = useState(2)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanContinue(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Full-screen warning overlay */}
      <div className="w-full max-w-3xl space-y-8 p-8 text-center">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-warning/20 p-6">
            <AlertTriangle className="h-16 w-16 text-warning" />
          </div>
        </div>

        {/* Main Message */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">DIVISION CHANGE DETECTED</h1>

          <div className="space-y-2 text-xl text-muted-foreground">
            <div className="flex items-center justify-center gap-4">
              <span className="font-semibold text-destructive">PREVIOUS:</span>
              <span className="font-mono">{previousDivision}</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <span className="font-semibold text-success">NEXT:</span>
              <span className="font-mono text-2xl font-bold text-primary">{nextDivision}</span>
            </div>
          </div>
        </div>

        {/* Standards Reminder */}
        {standards.length > 0 && (
          <div className="mx-auto max-w-2xl rounded-lg border-2 border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Standards Reminder</h2>
            <div className="space-y-3 text-left">
              {standards.map((standard, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center justify-between rounded-md p-3",
                    standard.hasChange ? "bg-warning/10" : "bg-muted/30",
                  )}
                >
                  <span className="font-medium">{standard.label}:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground line-through">{standard.previous}</span>
                    <span className="text-lg font-bold text-primary">{standard.next}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="space-y-3">
          <Button
            onClick={onContinue}
            disabled={!canContinue}
            size="lg"
            className="h-16 w-full max-w-md text-lg font-semibold"
          >
            {canContinue ? `I UNDERSTAND - START HEAT ${nextHeatNumber}` : `Please wait ${countdown}s...`}
          </Button>
          {!canContinue && (
            <p className="text-sm text-muted-foreground">
              Button will be enabled in {countdown} second{countdown !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
