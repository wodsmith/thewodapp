"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Zap,
  Settings,
  AlertTriangle,
  List,
  Grid,
} from "lucide-react";
import ScheduleStats from "./ScheduleStats";
import TimeSlotManager from "./TimeSlotManager";
import ScheduleGrid from "./ScheduleGrid";
import MasterSchedule from "./MasterSchedule";

interface TimeSlots {
  [key: string]: string[];
}

interface ScheduleSlot {
  class: string;
  coach: string | null;
  status: string;
}

interface Schedule {
  [key: string]: ScheduleSlot;
}

const Schedule = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentWeek, setCurrentWeek] = useState("March 4-10, 2024");
  const [showTimeSlotManager, setShowTimeSlotManager] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "master">("grid");

  const locations = [
    "Main Floor",
    "Studio 2",
    "Lifting Platform",
    "Outdoor Area",
  ];
  const classTypes = [
    "CrossFit WOD",
    "Yoga Flow",
    "Olympic Lifting",
    "Kids Class",
  ];

  // Custom time slots for each location and class type
  const [timeSlots, setTimeSlots] = useState<TimeSlots>({
    "Main Floor-CrossFit WOD": [
      "5:15 AM",
      "6:15 AM",
      "7:15 AM",
      "9:30 AM",
      "12:00 PM",
      "4:15 PM",
      "5:15 PM",
      "6:15 PM",
    ],
    "Studio 2-Yoga Flow": ["9:00 AM", "11:00 AM", "6:00 PM"],
    "Lifting Platform-Olympic Lifting": ["7:00 AM", "10:00 AM", "3:00 PM"],
    "Outdoor Area-CrossFit WOD": ["9:00 AM", "10:00 AM"],
  });

  const [schedule, setSchedule] = useState<Schedule>({
    "Monday-5:15 AM-Main Floor": {
      class: "CrossFit WOD",
      coach: "Sarah Johnson",
      status: "scheduled",
    },
    "Monday-6:15 AM-Main Floor": {
      class: "CrossFit WOD",
      coach: "Mike Chen",
      status: "scheduled",
    },
    "Monday-9:00 AM-Studio 2": {
      class: "Yoga Flow",
      coach: "Emma Davis",
      status: "scheduled",
    },
    "Tuesday-5:15 AM-Main Floor": {
      class: "CrossFit WOD",
      coach: "Sarah Johnson",
      status: "scheduled",
    },
    "Tuesday-6:00 PM-Studio 2": {
      class: "Yoga Flow",
      coach: "Emma Davis",
      status: "scheduled",
    },
    "Wednesday-7:00 AM-Lifting Platform": {
      class: "Olympic Lifting",
      coach: "Mike Chen",
      status: "scheduled",
    },
    "Wednesday-5:15 PM-Main Floor": {
      class: "CrossFit WOD",
      coach: null,
      status: "unscheduled",
    },
    "Thursday-6:15 AM-Main Floor": {
      class: "CrossFit WOD",
      coach: "Sarah Johnson",
      status: "scheduled",
    },
    "Friday-4:15 PM-Main Floor": {
      class: "CrossFit WOD",
      coach: null,
      status: "unscheduled",
    },
    "Saturday-9:00 AM-Outdoor Area": {
      class: "CrossFit WOD",
      coach: "Mike Chen",
      status: "scheduled",
    },
  });

  const generateSchedule = async () => {
    setIsGenerating(true);
    // Simulate AI scheduling process
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsGenerating(false);
  };

  const unscheduledCount = Object.values(schedule).filter(
    (slot) => slot.status === "unscheduled"
  ).length;
  const totalScheduled = Object.keys(schedule).length - unscheduledCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-orange-500 to-pink-600 p-2 rounded-xl">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  Schedule Generator
                </h1>
                <p className="text-sm text-slate-600">
                  AI-powered weekly class scheduling
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() =>
                  setViewMode(viewMode === "grid" ? "master" : "grid")
                }
                variant="outline"
                className="border-slate-300"
              >
                {viewMode === "grid" ? (
                  <>
                    <List className="h-4 w-4 mr-2" />
                    Master View
                  </>
                ) : (
                  <>
                    <Grid className="h-4 w-4 mr-2" />
                    Grid View
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowTimeSlotManager(!showTimeSlotManager)}
                variant="outline"
                className="border-slate-300"
              >
                <Settings className="h-4 w-4 mr-2" />
                Time Slots
              </Button>
              <Button
                onClick={generateSchedule}
                disabled={isGenerating}
                className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Schedule
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <ScheduleStats
          currentWeek={currentWeek}
          totalScheduled={totalScheduled}
          unscheduledCount={unscheduledCount}
        />

        {showTimeSlotManager && (
          <TimeSlotManager
            timeSlots={timeSlots}
            setTimeSlots={setTimeSlots}
            locations={locations}
            classTypes={classTypes}
          />
        )}

        {/* Alert for unscheduled classes */}
        {unscheduledCount > 0 && (
          <Card className="bg-orange-50 border-orange-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-medium text-orange-800">
                    {unscheduledCount} classes need manual assignment
                  </h3>
                  <p className="text-sm text-orange-700">
                    These classes couldn't be automatically assigned due to
                    constraints. Please review and assign coaches manually.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === "grid" ? (
          <ScheduleGrid
            schedule={schedule}
            setSchedule={setSchedule}
            timeSlots={timeSlots}
            locations={locations}
            currentWeek={currentWeek}
          />
        ) : (
          <MasterSchedule schedule={schedule} currentWeek={currentWeek} />
        )}
      </main>
    </div>
  );
};

export default Schedule;
