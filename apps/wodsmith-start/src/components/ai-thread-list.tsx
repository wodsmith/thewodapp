/**
 * @fileoverview AI Thread List Component
 *
 * Displays a list of past AI conversations, allowing users to:
 * - View conversation history
 * - Continue previous conversations
 * - Start new conversations
 * - Delete old conversations
 */
import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Thread {
	id: string
	title: string | null
	createdAt: string
	updatedAt: string
}

interface AIThreadListProps {
	/** Currently active thread ID */
	activeThreadId?: string
	/** Callback when a thread is selected */
	onSelectThread: (threadId: string | null) => void
	/** Callback when new thread is requested */
	onNewThread: () => void
	/** Optional class name */
	className?: string
}

/**
 * Sidebar component showing past AI conversations.
 */
export function AIThreadList({
	activeThreadId,
	onSelectThread,
	onNewThread,
	className,
}: AIThreadListProps) {
	const [threads, setThreads] = useState<Thread[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchThreads = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
			const res = await fetch("/api/ai/threads")
			if (!res.ok) {
				throw new Error("Failed to load conversations")
			}
			const data = (await res.json()) as { threads?: Thread[] }
			setThreads(data.threads ?? [])
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load")
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchThreads()
	}, [fetchThreads])

	const deleteThread = useCallback(
		async (threadId: string, e: React.MouseEvent) => {
			e.stopPropagation()

			// Optimistic update
			setThreads((prev) => prev.filter((t) => t.id !== threadId))

			try {
				const res = await fetch(`/api/ai/threads/${threadId}`, {
					method: "DELETE",
				})

				if (!res.ok) {
					// Revert on error
					fetchThreads()
					return
				}

				// If deleted thread was active, clear selection
				if (activeThreadId === threadId) {
					onSelectThread(null)
				}
			} catch {
				// Revert on error
				fetchThreads()
			}
		},
		[activeThreadId, onSelectThread, fetchThreads],
	)

	const getThreadTitle = (thread: Thread): string => {
		if (thread.title) return thread.title
		// Generate a title from the thread ID or date
		try {
			const date = new Date(thread.createdAt)
			return `Chat from ${date.toLocaleDateString()}`
		} catch {
			return "New conversation"
		}
	}

	const getRelativeTime = (dateStr: string): string => {
		try {
			return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
		} catch {
			return "Unknown"
		}
	}

	return (
		<div className={cn("flex flex-col h-full bg-muted/30", className)}>
			{/* New chat button */}
			<div className="p-3 border-b">
				<Button
					onClick={onNewThread}
					variant="outline"
					className="w-full justify-start"
					size="sm"
				>
					<Plus className="h-4 w-4 mr-2" />
					New Chat
				</Button>
			</div>

			{/* Thread list */}
			<ScrollArea className="flex-1">
				<div className="p-2 space-y-1">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					)}

					{error && (
						<div className="text-sm text-destructive text-center py-4">
							{error}
							<Button
								variant="link"
								size="sm"
								onClick={fetchThreads}
								className="block mx-auto mt-1"
							>
								Retry
							</Button>
						</div>
					)}

					{!isLoading && !error && threads.length === 0 && (
						<p className="text-sm text-muted-foreground text-center py-8">
							No conversations yet.
							<br />
							Start a new chat to begin.
						</p>
					)}

					{!isLoading &&
						!error &&
						threads.map((thread) => (
							// biome-ignore lint/a11y/useSemanticElements: Contains nested button, can't use button element
							<div
								key={thread.id}
								className={cn(
									"group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
									"hover:bg-accent",
									activeThreadId === thread.id && "bg-accent",
								)}
								onClick={() => onSelectThread(thread.id)}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										onSelectThread(thread.id)
									}
								}}
							>
								<MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{getThreadTitle(thread)}
									</p>
									<p className="text-xs text-muted-foreground">
										{getRelativeTime(thread.updatedAt)}
									</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
									onClick={(e) => deleteThread(thread.id, e)}
									aria-label="Delete conversation"
								>
									<Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
								</Button>
							</div>
						))}
				</div>
			</ScrollArea>
		</div>
	)
}
