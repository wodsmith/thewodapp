"use client"

import { Search } from "lucide-react"
import type { Route } from "next"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { Movement, Tag } from "@/types"

interface WorkoutControlsProps {
	allTags: Tag["name"][]
	allMovements: Movement["name"][]
	programmingTracks?: {
		trackId: string
		trackName: string
		trackDescription: string | null
		subscribedTeamId: string
		subscribedTeamName: string
	}[]
}

export default function WorkoutControls({
	allTags,
	allMovements,
	programmingTracks = [],
}: WorkoutControlsProps) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")
	const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "")
	const [selectedMovement, setSelectedMovement] = useState(
		searchParams.get("movement") || "",
	)
	const [workoutType, setWorkoutType] = useState(searchParams.get("type") || "")
	const [selectedTrackId, setSelectedTrackId] = useState(
		searchParams.get("trackId") || "",
	)

	useEffect(() => {
		const params = new URLSearchParams(searchParams.toString())
		if (searchTerm) {
			params.set("search", searchTerm)
		} else {
			params.delete("search")
		}

		if (selectedTag) {
			params.set("tag", selectedTag)
		} else {
			params.delete("tag")
		}

		if (selectedMovement) {
			params.set("movement", selectedMovement)
		} else {
			params.delete("movement")
		}

		if (workoutType) {
			params.set("type", workoutType)
		} else {
			params.delete("type")
		}

		if (selectedTrackId) {
			params.set("trackId", selectedTrackId)
		} else {
			params.delete("trackId")
		}

		router.replace(`${pathname}?${params.toString()}` as Route, {
			scroll: false,
		})
	}, [
		searchTerm,
		selectedTag,
		selectedMovement,
		workoutType,
		selectedTrackId,
		router,
		pathname,
		searchParams,
	])

	return (
		<div className="mb-6 flex flex-col gap-4 sm:flex-row">
			<div className="relative flex-1">
				<Search className="-translate-y-1/2 absolute top-1/2 left-3 transform text-gray-500" />
				<Input
					type="text"
					placeholder="Search workouts..."
					className="w-full pl-10"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
			</div>
			<div className="flex flex-wrap gap-2 sm:gap-4">
				<SearchableSelect
					value={selectedTag}
					onValueChange={(value) =>
						setSelectedTag(value === "all" ? "" : value)
					}
					options={allTags}
					placeholder="All Tags"
					searchPlaceholder="Search tags..."
					className="w-full sm:w-[180px]"
				/>
				<SearchableSelect
					value={selectedMovement}
					onValueChange={(value) =>
						setSelectedMovement(value === "all" ? "" : value)
					}
					options={allMovements}
					placeholder="All Movements"
					searchPlaceholder="Search movements..."
					className="w-full sm:w-[180px]"
				/>
				<Select
					value={workoutType}
					onValueChange={(value) =>
						setWorkoutType(value === "all" ? "" : value)
					}
				>
					<SelectTrigger className="w-full sm:w-[180px]">
						<SelectValue placeholder="All Workouts" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Workouts</SelectItem>
						<SelectItem value="original">Original Only</SelectItem>
						<SelectItem value="remix">Remixes Only</SelectItem>
					</SelectContent>
				</Select>
				{programmingTracks.length > 0 && (
					<SearchableSelect
						value={selectedTrackId}
						onValueChange={(value) =>
							setSelectedTrackId(value === "all" ? "" : value)
						}
						options={programmingTracks.map((track) => ({
							value: track.trackId,
							label: track.trackName,
						}))}
						placeholder="All Tracks"
						searchPlaceholder="Search tracks..."
						className="w-full sm:w-[180px]"
					/>
				)}
			</div>
			{/* The Filter button is currently not used for modal functionality */}
			{/* <button className="btn-outline flex items-center gap-2">
				<Filter className="h-5 w-5" />
				Filter
			</button> */}
		</div>
	)
}
