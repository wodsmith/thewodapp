'use client'

import * as React from 'react'
import {Calendar} from '@/components/ui/calendar'
import {LogRowCard} from '@/components/log-row-card'

interface LogEntry {
  id: string
  workoutId: string | null
  workoutName?: string | null
  date: Date
  displayScore?: string | null
  notes: string | null
  scalingLevelLabel?: string | null
  scalingLevelId?: string | null
  asRx: boolean
}

interface LogCalendarProps {
  logs: LogEntry[]
}

export function LogCalendar({logs}: LogCalendarProps) {
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [selectedLog, setSelectedLog] = React.useState<LogEntry[] | null>(null)

  const handleDateSelect = React.useCallback(
    (selectedDate: Date | undefined) => {
      setDate(selectedDate)
      if (selectedDate) {
        const logsForDay = logs.filter(
          (log) =>
            new Date(log.date).toDateString() === selectedDate.toDateString(),
        )
        setSelectedLog(logsForDay.length > 0 ? logsForDay : null)
      } else {
        setSelectedLog(null)
      }
    },
    [logs],
  )

  React.useEffect(() => {
    handleDateSelect(date)
  }, [date, handleDateSelect])

  const loggedDates = logs.map((log) => new Date(log.date))

  return (
    <div className="flex flex-col gap-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={handleDateSelect}
        className="h-fit w-full rounded-md border p-4 [--cell-size:2.5rem]"
        modifiers={{
          logged: loggedDates,
        }}
        modifiersStyles={{
          logged: {
            fontWeight: 'bold',
            textDecoration: 'underline',
            textDecorationColor: 'hsl(var(--primary))',
            textDecorationThickness: '2px',
            textUnderlineOffset: '0.2em',
          },
        }}
      />
      {selectedLog && selectedLog.length > 0 && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <ul className="space-y-2">
            {selectedLog.map((logEntry) => (
              <LogRowCard key={logEntry.id} logEntry={logEntry} />
            ))}
          </ul>
        </div>
      )}
      {(!selectedLog || selectedLog.length === 0) && date && (
        <div className="rounded-md border p-4">
          <h3 className="mb-2 text-sm font-bold">
            No workout logged for this day.
          </h3>
          <p className="text-sm text-muted-foreground">
            {date.toLocaleDateString()}
          </p>
        </div>
      )}
      {!date && (
        <div className="rounded-md border p-4">
          <h3 className="mb-2 w-fit text-balance text-sm font-bold">
            Select a date to view workout results.
          </h3>
        </div>
      )}
    </div>
  )
}
