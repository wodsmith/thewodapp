"use client"

import * as React from "react"
import { Video, CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/utils/cn"
import {
	parseVideoUrl,
	getSupportedPlatformsText,
	type ParsedVideoUrl,
	VIDEO_URL_ERRORS,
} from "@/schemas/video-url"

export interface VideoUrlValidationState {
	isValid: boolean
	isPending: boolean
	error: string | null
	parsedUrl: ParsedVideoUrl | null
}

export interface VideoUrlInputProps
	extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
	/** Current video URL value */
	value?: string
	/** Callback when the value changes */
	onChange?: (value: string) => void
	/** Callback when validation state changes */
	onValidationChange?: (state: VideoUrlValidationState) => void
	/** Whether the field is required */
	required?: boolean
	/** When to validate: 'blur' (default) or 'change' */
	validateOn?: "blur" | "change"
	/** Debounce delay in ms for validation when validateOn='change' (default: 300) */
	debounceMs?: number
	/** Show platform badge when valid */
	showPlatformBadge?: boolean
	/** Show video preview link when valid */
	showPreviewLink?: boolean
}

/**
 * Video URL Input Component
 *
 * Input field with real-time validation for YouTube and Vimeo URLs.
 * Shows validation state, platform badges, and helpful error messages.
 */
const VideoUrlInput = React.forwardRef<HTMLInputElement, VideoUrlInputProps>(
	(
		{
			className,
			value = "",
			onChange,
			onValidationChange,
			required = false,
			validateOn = "blur",
			debounceMs = 300,
			showPlatformBadge = true,
			showPreviewLink = true,
			disabled,
			...props
		},
		ref,
	) => {
		const [localValue, setLocalValue] = React.useState(value)
		const [hasBlurred, setHasBlurred] = React.useState(false)
		const [validationState, setValidationState] =
			React.useState<VideoUrlValidationState>({
				isValid: false,
				isPending: false,
				error: null,
				parsedUrl: null,
			})

		// Sync local value with controlled value
		React.useEffect(() => {
			setLocalValue(value)
		}, [value])

		// Validation function
		const validateUrl = React.useCallback(
			(urlToValidate: string) => {
				const trimmedValue = urlToValidate.trim()

				// Handle empty value
				if (!trimmedValue) {
					const newState: VideoUrlValidationState = {
						isValid: !required,
						isPending: false,
						error: required ? VIDEO_URL_ERRORS.EMPTY_URL : null,
						parsedUrl: null,
					}
					setValidationState(newState)
					onValidationChange?.(newState)
					return
				}

				// Check if it's a valid URL format first
				try {
					new URL(trimmedValue)
				} catch {
					const newState: VideoUrlValidationState = {
						isValid: false,
						isPending: false,
						error: VIDEO_URL_ERRORS.INVALID_URL,
						parsedUrl: null,
					}
					setValidationState(newState)
					onValidationChange?.(newState)
					return
				}

				// Parse and validate the video URL
				const parsed = parseVideoUrl(trimmedValue)
				if (parsed) {
					const newState: VideoUrlValidationState = {
						isValid: true,
						isPending: false,
						error: null,
						parsedUrl: parsed,
					}
					setValidationState(newState)
					onValidationChange?.(newState)
				} else {
					const newState: VideoUrlValidationState = {
						isValid: false,
						isPending: false,
						error: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
						parsedUrl: null,
					}
					setValidationState(newState)
					onValidationChange?.(newState)
				}
			},
			[required, onValidationChange],
		)

		// Debounced validation for 'change' mode
		React.useEffect(() => {
			if (validateOn !== "change") return

			// Set pending state during debounce
			setValidationState((prev) => ({ ...prev, isPending: true }))

			const timeoutId = setTimeout(() => {
				validateUrl(localValue)
			}, debounceMs)

			return () => clearTimeout(timeoutId)
		}, [localValue, validateOn, debounceMs, validateUrl])

		// Re-validate on blur if already blurred (for 'blur' mode)
		React.useEffect(() => {
			if (validateOn !== "blur" || !hasBlurred) return
			validateUrl(localValue)
		}, [localValue, validateOn, hasBlurred, validateUrl])

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setLocalValue(newValue)
			onChange?.(newValue)
		}

		const handleBlur = () => {
			if (validateOn === "blur") {
				setHasBlurred(true)
				validateUrl(localValue)
			}
		}

		const { isValid, isPending, error, parsedUrl } = validationState
		const hasValue = localValue.trim().length > 0
		const showValidIcon = hasValue && isValid && !isPending
		const showErrorIcon = hasValue && !isValid && !isPending && error && hasBlurred
		const showPendingIcon = isPending && validateOn === "change"

		return (
			<div className="space-y-2">
				<div className="relative">
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
						<Video className="h-4 w-4" />
					</div>
					<Input
						ref={ref}
						type="url"
						value={localValue}
						onChange={handleChange}
						onBlur={handleBlur}
						className={cn(
							"pl-9 pr-10",
							error && hasValue && hasBlurred && "border-destructive focus-visible:ring-destructive",
							isValid && hasValue && "border-green-500 focus-visible:ring-green-500",
							className,
						)}
						placeholder="Paste video URL..."
						disabled={disabled}
						aria-invalid={!!error && hasValue && hasBlurred}
						{...props}
					/>
					<div className="absolute right-3 top-1/2 -translate-y-1/2">
						{showPendingIcon && (
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
						)}
						{showValidIcon && (
							<CheckCircle2 className="h-4 w-4 text-green-500" />
						)}
						{showErrorIcon && (
							<XCircle className="h-4 w-4 text-destructive" />
						)}
					</div>
				</div>

				{/* Validation feedback */}
				{hasValue && !isPending && (
					<div className="flex items-center gap-2 text-sm">
						{isValid && parsedUrl && (
							<>
								{showPlatformBadge && (
									<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
										{parsedUrl.platform === "youtube"
											? "YouTube"
											: parsedUrl.platform === "vimeo"
												? "Vimeo"
												: "Streamable"}
									</span>
								)}
								{showPreviewLink && (
									<a
										href={parsedUrl.originalUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
									>
										Preview video
										<ExternalLink className="h-3 w-3" />
									</a>
								)}
							</>
						)}
						{error && hasBlurred && (
							<div className="flex items-center gap-1 text-destructive">
								<AlertCircle className="h-3 w-3" />
								<span className="text-xs">{error}</span>
							</div>
						)}
					</div>
				)}

				{/* Helper text when empty */}
				{!hasValue && !required && (
					<p className="text-xs text-muted-foreground">
						Accepted formats: {getSupportedPlatformsText()}
					</p>
				)}
			</div>
		)
	},
)
VideoUrlInput.displayName = "VideoUrlInput"

/**
 * Simple video URL validation hook for use outside the component
 *
 * @param url - The video URL to validate
 * @param required - Whether the URL is required (default: false).
 *                   When false, empty URLs are considered valid.
 *                   When true, empty URLs return isValid: false with an error.
 */
export function useVideoUrlValidation(
	url: string,
	required = false,
): VideoUrlValidationState {
	const [state, setState] = React.useState<VideoUrlValidationState>({
		isValid: false,
		isPending: true,
		error: null,
		parsedUrl: null,
	})

	React.useEffect(() => {
		const trimmedUrl = url.trim()

		if (!trimmedUrl) {
			setState({
				isValid: !required,
				isPending: false,
				error: required ? VIDEO_URL_ERRORS.EMPTY_URL : null,
				parsedUrl: null,
			})
			return
		}

		// Check URL format
		try {
			new URL(trimmedUrl)
		} catch {
			setState({
				isValid: false,
				isPending: false,
				error: VIDEO_URL_ERRORS.INVALID_URL,
				parsedUrl: null,
			})
			return
		}

		// Parse video URL
		const parsed = parseVideoUrl(trimmedUrl)
		if (parsed) {
			setState({
				isValid: true,
				isPending: false,
				error: null,
				parsedUrl: parsed,
			})
		} else {
			setState({
				isValid: false,
				isPending: false,
				error: VIDEO_URL_ERRORS.UNSUPPORTED_PLATFORM,
				parsedUrl: null,
			})
		}
	}, [url, required])

	return state
}

export { VideoUrlInput }
