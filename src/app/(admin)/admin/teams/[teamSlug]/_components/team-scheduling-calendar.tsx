"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, DateSelectArg } from "@fullcalendar/core"

interface TeamSchedulingCalendarProps {
	teamId: string
	events: Array<{
		id: string
		title: string
		start: string
		allDay?: boolean
		extendedProps?: {
			workoutName: string
			notes?: string
			classTimes?: string
		}
	}>
	onDateSelect?: (selectInfo: DateSelectArg) => void
	onEventClick?: (clickInfo: EventClickArg) => void
	onEventDrop?: (dropInfo: any) => void
}

export function TeamSchedulingCalendar({
	teamId,
	events,
	onDateSelect,
	onEventClick,
	onEventDrop,
}: TeamSchedulingCalendarProps) {
	return (
		<div className="team-scheduling-calendar">
			<FullCalendar
				plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
				headerToolbar={{
					left: "prev,next today",
					center: "title",
					right: "dayGridMonth,timeGridWeek,timeGridDay",
				}}
				initialView="dayGridMonth"
				editable={true}
				selectable={true}
				selectMirror={true}
				dayMaxEvents={true}
				weekends={true}
				events={events}
				select={onDateSelect}
				eventClick={onEventClick}
				eventDrop={onEventDrop}
				height="auto"
			/>
		</div>
	)
}
