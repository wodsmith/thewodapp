import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import FullCalendar from "@fullcalendar/react"
import timeGridPlugin from "@fullcalendar/timegrid"

export function ScheduleCalendar() {
	return (
		<div className="mt-8">
			<FullCalendar
				plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
				initialView="dayGridMonth"
				headerToolbar={{
					left: "prev,next today",
					center: "title",
					right: "dayGridMonth,timeGridWeek,timeGridDay",
				}}
				editable={true}
				selectable={true}
				selectMirror={true}
				dayMaxEvents={true}
				// events={[]}
				// eventContent={renderEventContent}
				// eventClick={handleEventClick}
				// datesSet={handleDatesSet}
			/>
		</div>
	)
}
