"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"

export interface CalendarProps {
	mode?: "single" | "multiple" | "range"
	selected?: Date | Date[] | { from?: Date; to?: Date }
	onSelect?: (date: Date | undefined) => void
	className?: string
	modifiers?: {
		[key: string]: Date[]
	}
	modifiersStyles?: {
		[key: string]: React.CSSProperties
	}
}

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function Calendar({
	mode = "single",
	selected,
	onSelect,
	className,
	modifiers = {},
	modifiersStyles = {},
	...props
}: CalendarProps) {
	const [currentDate, setCurrentDate] = React.useState(new Date())

	const year = currentDate.getFullYear()
	const month = currentDate.getMonth()

	const firstDayOfMonth = new Date(year, month, 1)
	const lastDayOfMonth = new Date(year, month + 1, 0)
	const startDate = new Date(firstDayOfMonth)
	startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay())

	const endDate = new Date(lastDayOfMonth)
	endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()))

	const days = []
	const current = new Date(startDate)

	while (current <= endDate) {
		days.push(new Date(current))
		current.setDate(current.getDate() + 1)
	}

	const navigateMonth = (direction: "prev" | "next") => {
		setCurrentDate((prev) => {
			const newDate = new Date(prev)
			if (direction === "prev") {
				newDate.setMonth(newDate.getMonth() - 1)
			} else {
				newDate.setMonth(newDate.getMonth() + 1)
			}
			return newDate
		})
	}

	const isSelected = (date: Date) => {
		if (!selected) return false
		if (selected instanceof Date) {
			return date.toDateString() === selected.toDateString()
		}
		return false
	}

	const getModifierStyles = (date: Date) => {
		let styles = {}
		for (const [key, dates] of Object.entries(modifiers)) {
			if (dates.some((d) => d.toDateString() === date.toDateString())) {
				styles = { ...styles, ...modifiersStyles[key] }
			}
		}
		return styles
	}

	return (
		<div className={cn("p-3", className)} {...props}>
			<div className="flex items-center justify-between mb-4">
				<Button
					variant="outline"
					size="sm"
					onClick={() => navigateMonth("prev")}
					className="h-7 w-7 p-0"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<h2 className="text-sm font-semibold">
					{MONTHS[month]} {year}
				</h2>
				<Button
					variant="outline"
					size="sm"
					onClick={() => navigateMonth("next")}
					className="h-7 w-7 p-0"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>

			<div className="grid grid-cols-7 gap-1 mb-2">
				{DAYS.map((day) => (
					<div
						key={day}
						className="text-center text-sm font-medium text-muted-foreground p-2"
					>
						{day}
					</div>
				))}
			</div>

			<div className="grid grid-cols-7 gap-1">
				{days.map((date) => {
					const isCurrentMonth = date.getMonth() === month
					const isToday = date.toDateString() === new Date().toDateString()
					const selected = isSelected(date)
					const modifierStyles = getModifierStyles(date)

					return (
						<Button
							key={date.toISOString()}
							variant="ghost"
							size="sm"
							className={cn(
								"h-9 w-9 p-0 font-normal",
								!isCurrentMonth && "text-muted-foreground opacity-50",
								isToday && "bg-orange text-accent-foreground",
								selected &&
									"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
							)}
							style={modifierStyles}
							onClick={() => {
								if (onSelect && isCurrentMonth) {
									onSelect(date)
								}
							}}
						>
							{date.getDate()}
						</Button>
					)
				})}
			</div>
		</div>
	)
}
