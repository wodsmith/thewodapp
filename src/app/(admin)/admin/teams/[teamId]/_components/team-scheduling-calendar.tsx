"use client"

import type {
	DateSelectArg,
	EventClickArg,
	EventDropArg,
} from "@fullcalendar/core"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"
import "./team-scheduling-calendar.css"

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
	onEventDrop?: (dropInfo: EventDropArg) => void
}

export function TeamSchedulingCalendar({
	teamId,
	events,
	onDateSelect,
	onEventClick,
	onEventDrop,
}: TeamSchedulingCalendarProps) {
	// Debug log for CSS styling verification
	console.log(
		"DEBUG: [Calendar] Applied brutalist CSS overrides for FullCalendar components",
	)

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
