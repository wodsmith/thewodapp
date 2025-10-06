"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { Calendar } from "@/components/ui/calendar"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"

type ViewMode = "daily" | "weekly"

interface TeamControlsProps {
	viewMode: ViewMode
	selectedDate: Date
	onViewModeChange: (mode: ViewMode) => void
	onDateChange: (date: Date) => void
}

export function TeamControls({
	viewMode,
	selectedDate,
	onViewModeChange,
	onDateChange,
}: TeamControlsProps) {
	const handlePrevious = () => {
		const newDate = new Date(selectedDate)
		if (viewMode === "daily") {
			newDate.setDate(newDate.getDate() - 1)
		} else {
			newDate.setDate(newDate.getDate() - 7)
		}
		onDateChange(newDate)
	}

	const handleNext = () => {
		const newDate = new Date(selectedDate)
		if (viewMode === "daily") {
			newDate.setDate(newDate.getDate() + 1)
		} else {
			newDate.setDate(newDate.getDate() + 7)
		}
		onDateChange(newDate)
	}

	const handleToday = () => {
		onDateChange(new Date())
	}

	const formatDateDisplay = () => {
		if (viewMode === "daily") {
			return selectedDate.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		} else {
			// For weekly view, show week range
			const weekStart = new Date(selectedDate)
			weekStart.setDate(selectedDate.getDate() - selectedDate.getDay())
			const weekEnd = new Date(weekStart)
			weekEnd.setDate(weekStart.getDate() + 6)

			return `${weekStart.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			})} - ${weekEnd.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})}`
		}
	}

	return (
		<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
			{/* View Mode Toggle */}
			<ToggleGroup
				value={viewMode}
				onValueChange={(value) => {
					onViewModeChange(value as ViewMode)
				}}
				options={[
					{ value: "daily", label: "Daily" },
					{ value: "weekly", label: "Weekly" },
				]}
				className="justify-start"
			/>

			{/* Date Navigation */}
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					onClick={handlePrevious}
					aria-label={viewMode === "daily" ? "Previous day" : "Previous week"}
				>
					<ChevronLeftIcon className="h-4 w-4" />
				</Button>

				<Button variant="outline" onClick={handleToday}>
					Today
				</Button>

				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							className="min-w-[200px] justify-center font-medium"
						>
							<CalendarIcon className="mr-2 h-4 w-4" />
							{formatDateDisplay()}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="center">
						<Calendar
							mode="single"
							selected={selectedDate}
							onSelect={(date) => {
								if (date) {
									onDateChange(date)
								}
							}}
							initialFocus
						/>
					</PopoverContent>
				</Popover>

				<Button
					variant="outline"
					size="icon"
					onClick={handleNext}
					aria-label={viewMode === "daily" ? "Next day" : "Next week"}
				>
					<ChevronRightIcon className="h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
