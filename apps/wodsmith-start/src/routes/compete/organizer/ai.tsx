import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useCallback, useEffect, useRef } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { z } from "zod"
import { AIChat } from "@/components/ai-chat"
import { AIThreadList } from "@/components/ai-thread-list"

const searchSchema = z.object({
	thread: z.string().optional(),
})

export const Route = createFileRoute("/compete/organizer/ai")({
	component: OrganizerAIPage,
	validateSearch: searchSchema,
})

function OrganizerAIPage() {
	const { thread: urlThreadId } = Route.useSearch()
	const navigate = useNavigate({ from: Route.fullPath })

	const [initialMessages, setInitialMessages] = useState<
		UIMessage[] | undefined
	>(undefined)
	const [isLoadingThread, setIsLoadingThread] = useState(false)

	// Track thread IDs we created in this session - don't reload these
	const createdThreadsRef = useRef<Set<string>>(new Set())

	// Stable key for AIChat - only changes when we explicitly load a different thread
	// This prevents remounting when we create a new thread
	const [chatKey, setChatKey] = useState<string>("new")

	// Load thread from URL on mount or when URL changes
	// Skip loading if we just created this thread (messages are already in chat)
	useEffect(() => {
		if (urlThreadId) {
			if (createdThreadsRef.current.has(urlThreadId)) {
				// We just created this thread, don't reload - chat already has the messages
				return
			}
			loadThread(urlThreadId)
		} else {
			setInitialMessages(undefined)
		}
	}, [urlThreadId])

	// Load messages for a thread
	const loadThread = async (threadId: string) => {
		setIsLoadingThread(true)
		try {
			const res = await fetch(`/api/ai/threads/${threadId}`)
			if (!res.ok) {
				console.error("Failed to load thread")
				// Clear invalid thread from URL
				navigate({ search: { thread: undefined } })
				return
			}

			const data = (await res.json()) as {
				messages: Array<{ id: string; role: string; content: string }>
			}

			// Convert API messages to UIMessage format
			const uiMessages: UIMessage[] = data.messages.map((msg) => ({
				id: msg.id,
				role: msg.role as "user" | "assistant",
				parts: [{ type: "text" as const, text: msg.content }],
			}))

			setInitialMessages(uiMessages)
			// Update chat key to force remount with loaded messages
			setChatKey(threadId)
		} catch (error) {
			console.error("Error loading thread:", error)
		} finally {
			setIsLoadingThread(false)
		}
	}

	// Handle thread selection from sidebar
	const handleSelectThread = useCallback(
		(threadId: string | null) => {
			navigate({ search: { thread: threadId ?? undefined } })
		},
		[navigate],
	)

	// Handle new thread button
	const handleNewThread = useCallback(() => {
		navigate({ search: { thread: undefined } })
		setInitialMessages(undefined)
		// Reset to "new" key to start fresh
		setChatKey("new")
	}, [navigate])

	// Handle when chat creates a new thread
	const handleThreadChange = useCallback(
		(newThreadId: string) => {
			// Track this thread as created by us - don't reload it when URL changes
			createdThreadsRef.current.add(newThreadId)
			navigate({ search: { thread: newThreadId } })
		},
		[navigate],
	)

	return (
		<div className="container max-w-6xl mx-auto py-8">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Competition Planner</h1>
				<p className="text-muted-foreground">
					AI assistant for planning and managing competitions
				</p>
			</div>

			<div className="flex border rounded-lg h-[600px] overflow-hidden">
				{/* Thread sidebar */}
				<div className="w-64 border-r flex-shrink-0">
					<AIThreadList
						activeThreadId={urlThreadId}
						onSelectThread={handleSelectThread}
						onNewThread={handleNewThread}
					/>
				</div>

				{/* Chat area */}
				<div className="flex-1 relative">
					{isLoadingThread ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-muted-foreground">
								Loading conversation...
							</div>
						</div>
					) : (
						<AIChat
							key={chatKey}
							threadId={urlThreadId}
							initialMessages={initialMessages}
							onThreadChange={handleThreadChange}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
