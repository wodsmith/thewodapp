"use client"

import { useServerFn } from "@tanstack/react-start"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Video, Youtube } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitVideoFn } from "@/server-fns/video-submission-fns"

interface VideoSubmissionFormProps {
	trackWorkoutId: string
	competitionId: string
	timezone?: string | null
	initialData?: {
		submission: {
			id: string
			videoUrl: string
			notes: string | null
			submittedAt: Date
			updatedAt: Date
		} | null
		canSubmit: boolean
		reason?: string
		isRegistered: boolean
		submissionWindow?: {
			opensAt: string
			closesAt: string
		} | null
	}
}

function formatSubmissionTime(date: Date | string, timezone?: string | null): string {
	const d = typeof date === "string" ? new Date(date) : date
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone ?? undefined,
	}).format(d)
}

export function VideoSubmissionForm({
	trackWorkoutId,
	competitionId,
	timezone,
	initialData,
}: VideoSubmissionFormProps) {
	const [videoUrl, setVideoUrl] = useState(initialData?.submission?.videoUrl ?? "")
	const [notes, setNotes] = useState(initialData?.submission?.notes ?? "")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [hasSubmitted, setHasSubmitted] = useState(!!initialData?.submission)

	const submitVideo = useServerFn(submitVideoFn)

	// If user is not registered, show message
	if (!initialData?.isRegistered) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg flex items-center gap-2">
						<Video className="h-5 w-5" />
						Video Submission
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Registration Required</AlertTitle>
						<AlertDescription>
							You must be registered for this competition to submit a video.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		)
	}

	// If submission window is not open, show status
	if (!initialData?.canSubmit && initialData?.reason) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg flex items-center gap-2">
						<Video className="h-5 w-5" />
						Video Submission
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Submission Closed</AlertTitle>
						<AlertDescription>{initialData.reason}</AlertDescription>
					</Alert>
					{initialData?.submissionWindow && (
						<div className="text-sm text-muted-foreground space-y-1">
							<p>
								<strong>Opens:</strong>{" "}
								{formatSubmissionTime(initialData.submissionWindow.opensAt, timezone)}
							</p>
							<p>
								<strong>Closes:</strong>{" "}
								{formatSubmissionTime(initialData.submissionWindow.closesAt, timezone)}
							</p>
						</div>
					)}
					{hasSubmitted && initialData?.submission && (
						<div className="pt-2 border-t">
							<p className="text-sm font-medium mb-2">Your submitted video:</p>
							<a
								href={initialData.submission.videoUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-primary hover:underline"
							>
								<ExternalLink className="h-4 w-4" />
								{initialData.submission.videoUrl}
							</a>
						</div>
					)}
				</CardContent>
			</Card>
		)
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSuccess(null)

		if (!videoUrl.trim()) {
			setError("Please enter a video URL")
			return
		}

		// Basic URL validation
		try {
			new URL(videoUrl)
		} catch {
			setError("Please enter a valid URL")
			return
		}

		setIsSubmitting(true)

		try {
			const result = await submitVideo({
				data: {
					trackWorkoutId,
					competitionId,
					videoUrl: videoUrl.trim(),
					notes: notes.trim() || undefined,
				},
			})

			if (result.success) {
				setSuccess(
					result.isUpdate
						? "Video submission updated successfully!"
						: "Video submitted successfully!",
				)
				setHasSubmitted(true)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit video")
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-lg flex items-center gap-2">
					<Video className="h-5 w-5" />
					Video Submission
				</CardTitle>
				<CardDescription>
					{hasSubmitted
						? "Update your video submission below"
						: "Submit your workout video for this event"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Submission Window Info */}
					{initialData?.submissionWindow && (
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								Submissions close{" "}
								{formatSubmissionTime(initialData.submissionWindow.closesAt, timezone)}
							</AlertDescription>
						</Alert>
					)}

					{/* Video URL Input */}
					<div className="space-y-2">
						<Label htmlFor="videoUrl">Video URL</Label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Youtube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="videoUrl"
									type="url"
									placeholder="https://www.youtube.com/watch?v=..."
									value={videoUrl}
									onChange={(e) => setVideoUrl(e.target.value)}
									className="pl-10"
									disabled={isSubmitting}
								/>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							We recommend uploading your video to YouTube (unlisted is fine)
						</p>
					</div>

					{/* Notes Input */}
					<div className="space-y-2">
						<Label htmlFor="notes">Notes (Optional)</Label>
						<Textarea
							id="notes"
							placeholder="Any additional information about your submission..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={2}
							disabled={isSubmitting}
							maxLength={1000}
						/>
					</div>

					{/* Error Message */}
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Success Message */}
					{success && (
						<Alert className="border-green-500 text-green-700 dark:text-green-400">
							<CheckCircle2 className="h-4 w-4" />
							<AlertDescription>{success}</AlertDescription>
						</Alert>
					)}

					{/* Submit Button */}
					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Submitting...
							</>
						) : hasSubmitted ? (
							"Update Submission"
						) : (
							"Submit Video"
						)}
					</Button>

					{/* Previous Submission Info */}
					{hasSubmitted && initialData?.submission && (
						<div className="pt-2 border-t text-xs text-muted-foreground">
							Last submitted:{" "}
							{formatSubmissionTime(initialData.submission.submittedAt, timezone)}
						</div>
					)}
				</form>
			</CardContent>
		</Card>
	)
}
