"use client";

import { useState, useEffect, useCallback } from "react";
import { TeamSchedulingCalendar } from "./team-scheduling-calendar";
import { WorkoutSelectionModal } from "./workout-selection-modal";
import { getScheduledWorkoutsAction } from "../_actions/scheduling-actions";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import { useServerAction } from "zsa-react";
import { toast } from "sonner";
import type { ScheduledWorkoutInstanceWithDetails } from "@/server/scheduling-service";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  allDay?: boolean;
  extendedProps?: {
    workoutName: string;
    notes?: string;
    classTimes?: string;
  };
}

interface TeamSchedulingContainerProps {
  teamId: string;
}

export function TeamSchedulingContainer({
  teamId,
}: TeamSchedulingContainerProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { execute: getScheduledWorkouts, isPending: isLoadingWorkouts } =
    useServerAction(getScheduledWorkoutsAction);

  // Load scheduled workouts for the current month
  const loadScheduledWorkouts = useCallback(async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [result] = await getScheduledWorkouts({
      teamId,
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString(),
    });

    if (result?.success && result.data) {
      const calendarEvents = result.data.map(
        (workout: ScheduledWorkoutInstanceWithDetails): CalendarEvent => ({
          id: workout.id,
          title: `Workout (Day ${
            workout.trackWorkout?.dayNumber || "Unknown"
          })`,
          start: new Date(workout.scheduledDate).toISOString(),
          allDay: true,
          extendedProps: {
            workoutName: `Track Workout - Day ${
              workout.trackWorkout?.dayNumber || "Unknown"
            }`,
            notes: workout.teamSpecificNotes || undefined,
            classTimes: workout.classTimes || undefined,
          },
        })
      );

      setEvents(calendarEvents);
    } else {
      toast.error("Failed to load scheduled workouts");
    }
  }, [teamId, getScheduledWorkouts]);

  useEffect(() => {
    loadScheduledWorkouts();
  }, [loadScheduledWorkouts]);

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedDate(new Date(selectInfo.start));
    setIsModalOpen(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { event } = clickInfo;
    const props = event.extendedProps;

    toast.info(
      `Workout: ${props.workoutName || "Unknown"}${
        props.notes ? `\nNotes: ${props.notes}` : ""
      }`
    );
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event } = dropInfo;
    const newDate = event.start;

    // For now, just revert the drop since we need to implement the reschedule logic
    dropInfo.revert();
    toast.info(
      "Drag-and-drop rescheduling will be implemented in the next commit"
    );
  };

  const handleWorkoutScheduled = () => {
    // Reload the calendar events after scheduling
    loadScheduledWorkouts();
  };

  return (
    <div className="space-y-4">
      {isLoadingWorkouts && (
        <div className="text-center text-muted-foreground">
          Loading scheduled workouts...
        </div>
      )}

      <TeamSchedulingCalendar
        teamId={teamId}
        events={events}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
        onEventDrop={handleEventDrop}
      />

      <WorkoutSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        teamId={teamId}
        onWorkoutScheduled={handleWorkoutScheduled}
      />
    </div>
  );
}
