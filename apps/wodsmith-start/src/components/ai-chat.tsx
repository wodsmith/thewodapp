/**
 * @fileoverview AI Chat Component for competition planning assistance.
 *
 * Provides a chat interface for organizers to interact with the
 * Competition Planner AI agent. Uses AI SDK's useChat hook for
 * streaming responses.
 *
 * Supports conversation threading for history management.
 */

"use client"

import { useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Send, Loader2, Bot, User } from "lucide-react"

interface AIChatProps {
	/** Optional class name for the container */
	className?: string
	/** Thread ID for conversation continuity */
	threadId?: string
	/** Initial messages to display (for loading existing threads) */
	initialMessages?: UIMessage[]
	/** Callback when thread ID changes (new thread created) */
	onThreadChange?: (threadId: string) => void
	/** Initial system message to set context */
	initialContext?: string
	/** Placeholder text for the input */
	placeholder?: string
}

/**
 * AI Chat interface for competition planning assistance.
 *
 * Features:
 * - Streaming responses from the Competition Planner agent
 * - Conversation threading for history management
 * - Auto-scroll to latest messages
 * - Loading states during response generation
 * - Accessible keyboard navigation
 */
export function AIChat({
	className,
	threadId: propThreadId,
	initialMessages: propInitialMessages,
	onThreadChange,
	initialContext,
	placeholder = "Ask about competition planning...",
}: AIChatProps) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [input, setInput] = useState("")

	// Use a ref for threadId so transport body stays current without
	// recreating the transport (which would reset useChat mid-request).
	const threadIdRef = useRef(propThreadId)
	const onThreadChangeRef = useRef(onThreadChange)
	onThreadChangeRef.current = onThreadChange

	// Update ref when prop changes (e.g. navigating to an existing thread)
	useEffect(() => {
		threadIdRef.current = propThreadId
	}, [propThreadId])

	// Stable chat instance ID - doesn't change when threadId arrives
	const [chatId] = useState(() => propThreadId ?? `chat_${crypto.randomUUID()}`)

	// Prepare initial messages - combine context with loaded messages
	const combinedInitialMessages = useMemo(() => {
		const msgs: UIMessage[] = []

		// Add system context if provided
		if (initialContext) {
			msgs.push({
				id: "system-context",
				role: "system" as const,
				parts: [{ type: "text" as const, text: initialContext }],
			})
		}

		// Add loaded messages if provided
		if (propInitialMessages) {
			msgs.push(...propInitialMessages)
		}

		return msgs.length > 0 ? msgs : undefined
	}, [initialContext, propInitialMessages])

	// Stable transport - uses refs so it never recreates during a request.
	// The threadId in the body reads from the ref at fetch time.
	const transport = useMemo(() => {
		return new DefaultChatTransport({
			api: "/api/ai/chat",
			// body is read at fetch time via the custom fetch below
			body: {},
			fetch: async (url, init) => {
				// Inject the current threadId into the request body
				if (init?.body) {
					const parsed = JSON.parse(init.body as string)
					parsed.threadId = threadIdRef.current
					init = { ...init, body: JSON.stringify(parsed) }
				}

				const response = await fetch(url, init)

				// Capture new threadId from response without disrupting useChat
				const responseThreadId = response.headers.get("X-Thread-Id")
				if (responseThreadId && responseThreadId !== threadIdRef.current) {
					threadIdRef.current = responseThreadId
					onThreadChangeRef.current?.(responseThreadId)
				}

				return response
			},
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const { messages, sendMessage, regenerate, status, error } = useChat({
		id: chatId,
		messages: combinedInitialMessages,
		transport,
	})

	const isLoading = status === "submitted" || status === "streaming"

	// Handle input change
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setInput(e.target.value)
		},
		[],
	)

	// Handle form submission
	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			if (!input.trim() || isLoading) return

			const message = input
			setInput("")
			await sendMessage({ text: message })
		},
		[input, isLoading, sendMessage],
	)

	// Handle suggestion chip click
	const handleSuggestionClick = useCallback((text: string) => {
		setInput(text)
	}, [])

	// Auto-scroll to bottom when new messages arrive
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages triggers scroll on new arrivals
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages])

	// Extract text content from message parts
	const getMessageContent = (message: UIMessage): string => {
		const textParts = message.parts.filter((p) => p.type === "text")
		return textParts.map((p) => ("text" in p ? p.text : "")).join("")
	}

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Messages area */}
			<ScrollArea ref={scrollRef} className="flex-1 p-4">
				<div className="space-y-4">
					{messages.length === 0 && (
						<div className="text-center text-muted-foreground py-8">
							<Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p className="text-lg font-medium">Competition Planner</p>
							<p className="text-sm mt-2">
								I can help you create competitions, design events, generate
								schedules, and more.
							</p>
							<div className="mt-4 flex flex-wrap gap-2 justify-center">
								<SuggestionChip
									onClick={() =>
										handleSuggestionClick(
											"Create a weekend competition for 100 athletes with Rx and Scaled divisions",
										)
									}
								>
									Create a competition
								</SuggestionChip>
								<SuggestionChip
									onClick={() =>
										handleSuggestionClick(
											"Suggest 5 events testing all fitness domains",
										)
									}
								>
									Design events
								</SuggestionChip>
								<SuggestionChip
									onClick={() =>
										handleSuggestionClick(
											"What divisions should I have for a 200-athlete individual competition?",
										)
									}
								>
									Suggest divisions
								</SuggestionChip>
							</div>
						</div>
					)}

					{messages
						.filter((m) => m.role !== "system")
						.map((message) => (
							<MessageBubble
								key={message.id}
								role={message.role}
								content={getMessageContent(message)}
							/>
						))}

					{isLoading && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-sm">Thinking...</span>
						</div>
					)}

					{error && (
						<div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
							<p>Something went wrong: {error.message}</p>
							<Button
								variant="link"
								size="sm"
								onClick={() => regenerate()}
								className="p-0 h-auto text-destructive"
							>
								Try again
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Input area */}
			<form
				onSubmit={handleSubmit}
				className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
			>
				<div className="flex gap-2">
					<Input
						value={input}
						onChange={handleInputChange}
						placeholder={placeholder}
						disabled={isLoading}
						className="flex-1"
						aria-label="Chat message"
					/>
					<Button type="submit" disabled={isLoading || !input.trim()}>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
						<span className="sr-only">Send message</span>
					</Button>
				</div>
			</form>
		</div>
	)
}

/**
 * Individual message bubble component.
 */
function MessageBubble({ role, content }: { role: string; content: string }) {
	const isUser = role === "user"

	return (
		<div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
			<div
				className={cn(
					"flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
					isUser ? "bg-primary text-primary-foreground" : "bg-muted",
				)}
			>
				{isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
			</div>
			<div
				className={cn(
					"rounded-lg px-4 py-2 max-w-[80%]",
					isUser ? "bg-primary text-primary-foreground" : "bg-muted",
				)}
			>
				<div className="text-sm whitespace-pre-wrap">{content}</div>
			</div>
		</div>
	)
}

/**
 * Suggestion chip for quick actions.
 */
function SuggestionChip({
	children,
	onClick,
}: {
	children: React.ReactNode
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="px-3 py-1.5 text-xs rounded-full border border-border hover:bg-accent transition-colors"
		>
			{children}
		</button>
	)
}
