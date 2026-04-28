"use client"

import { ChevronDown, Download, FileText, Loader2, Table } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  buildHeatScheduleCsvRows,
  groupHeatsByEvent,
  HEAT_SCHEDULE_CSV_HEADERS,
} from "@/lib/heat-schedule-export"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { buildCsv, downloadCsv } from "@/utils/csv"

interface ExportHeatScheduleButtonProps {
  competitionSlug: string
  competitionName: string
  heats: HeatWithAssignments[]
  allEvents: CompetitionWorkout[]
}

function todayStamp(): string {
  return new Date().toISOString().split("T")[0]
}

export function ExportHeatScheduleButton({
  competitionSlug,
  competitionName,
  heats,
  allEvents,
}: ExportHeatScheduleButtonProps) {
  const [isExporting, setIsExporting] = useState<"csv" | "pdf" | null>(null)

  const handleExportCsv = () => {
    try {
      setIsExporting("csv")
      const groups = groupHeatsByEvent(heats, allEvents)
      const rows = buildHeatScheduleCsvRows(groups)
      const csv = buildCsv(HEAT_SCHEDULE_CSV_HEADERS, rows)
      downloadCsv(`${competitionSlug}-heat-schedule-${todayStamp()}.csv`, csv)
    } catch (error) {
      console.error("Failed to export heat schedule CSV:", error)
      toast.error("Failed to export heat schedule CSV")
    } finally {
      setIsExporting(null)
    }
  }

  const handleExportPdf = async () => {
    try {
      setIsExporting("pdf")
      // Dynamically import to keep @react-pdf/renderer out of the SSR bundle
      const { pdf } = await import("@react-pdf/renderer")
      const { HeatSchedulePdf } = await import("./heat-schedule-pdf")
      const groups = groupHeatsByEvent(heats, allEvents)
      const blob = await pdf(
        <HeatSchedulePdf
          competitionName={competitionName}
          generatedAt={new Date()}
          groups={groups}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${competitionSlug}-heat-schedule-${todayStamp()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export heat schedule PDF:", error)
      toast.error("Failed to export heat schedule PDF")
    } finally {
      setIsExporting(null)
    }
  }

  const disabled = isExporting !== null || heats.length === 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export schedule
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCsv}>
          <Table className="mr-2 h-4 w-4" />
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPdf}>
          <FileText className="mr-2 h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
