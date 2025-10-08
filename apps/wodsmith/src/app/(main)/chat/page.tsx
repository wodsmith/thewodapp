"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AlertCircle, Crown, Info, MessageCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import { useSessionStore } from "@/state/session"
import { checkCanUseAIAction } from "@/actions/entitlements-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Loader } from "@/components/ai-elements/loader"
import {
	Message,
	MessageAvatar,
	MessageContent,
} from "@/components/ai-elements/message"
import {
	PromptInput,
	PromptInputBody,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import { Response } from "@/components/ai-elements/response"
import type { LimitCheckResult } from "@/server/entitlements-checks"

export default function ChatPage() {
	const [input, setInput] = useState("")
	const currentTeam = useSessionStore((state) => state.currentTeam)
	const [aiLimit, setAiLimit] = useState<
		(LimitCheckResult & { hasFeature: boolean; remaining?: number }) | null
	>(null)

	const { execute: checkAI } = useServerAction(checkCanUseAIAction, {
		onSuccess: (result) => {
			if (result.data) {
				setAiLimit(result.data.data)
			}
		},
	})

	// Check AI limits when page loads or team changes
	useEffect(() => {
		if (currentTeam?.teamId) {
			checkAI({ teamId: currentTeam.teamId })
		}
	}, [currentTeam?.teamId, checkAI])

	const { messages, sendMessage, status, error } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat",
			body: {
				teamId: currentTeam?.teamId || "",
			},
		}),
		onFinish: () => {
			// Refresh AI limit after sending a message
			if (currentTeam?.teamId) {
				checkAI({ teamId: currentTeam.teamId })
			}
		},
	})

	const handleSubmit = (message: PromptInputMessage) => {
		if (!message.text?.trim()) return

		sendMessage({ text: message.text })
		setInput("")
	}

	const isLoading = status === "streaming" || status === "submitted"

	return (
		<div className="container mx-auto max-w-4xl py-8">
			<div className="flex flex-col h-[calc(100vh-12rem)]">
				{/* Header */}
				<div className="mb-4">
					<h1 className="text-2xl font-bold">Chat Assistant</h1>
					<p className="text-muted-foreground">
						Ask questions about your workouts and programming
					</p>
				</div>

				{/* AI Limit Warning */}
				{aiLimit && !aiLimit.canCreate && (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>
							{!aiLimit.hasFeature
								? "AI Features Not Available"
								: "AI Message Limit Reached"}
						</AlertTitle>
						<AlertDescription className="mt-2 space-y-2">
							<p>{aiLimit.message}</p>
							<Button size="sm" variant="outline" asChild className="mt-2">
								<Link href="/settings/billing">
									<Crown className="h-4 w-4 mr-2" />
									Upgrade Plan
								</Link>
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* AI Usage Info */}
				{aiLimit &&
					aiLimit.canCreate &&
					!aiLimit.isUnlimited &&
					aiLimit.message && (
						<Alert className="mb-4">
							<Info className="h-4 w-4" />
							<AlertTitle>AI Usage</AlertTitle>
							<AlertDescription>{aiLimit.message}</AlertDescription>
						</Alert>
					)}

				{/* Error Alert */}
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				)}

				{/* Messages Container */}
				<Conversation>
					<ConversationContent>
						{messages.length === 0 && (
							<ConversationEmptyState
								icon={<MessageCircle className="size-8" />}
								title="Start a conversation"
								description="Ask me anything about your training"
							/>
						)}

						{messages.map((message) => (
							<Message key={message.id} from={message.role}>
								<MessageAvatar
									src={
										message.role === "user"
											? "/avatar-placeholder.png"
											: "/bot-avatar.png"
									}
									name={message.role === "user" ? "You" : "AI"}
								/>
								<MessageContent>
									{message.parts.map((part, i) => {
										if (part.type === "text") {
											return (
												<Response key={`${message.id}-${i}`}>
													{part.text}
												</Response>
											)
										}
										return null
									})}
								</MessageContent>
							</Message>
						))}

						{isLoading && (
							<Message from="assistant">
								<MessageAvatar src="/bot-avatar.png" name="AI" />
								<MessageContent>
									<Loader />
								</MessageContent>
							</Message>
						)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				{/* Input Form */}
				<PromptInput onSubmit={handleSubmit}>
					<PromptInputBody>
						<PromptInputTextarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={
								aiLimit && !aiLimit.canCreate
									? "Upgrade your plan to continue using AI..."
									: "Ask me anything about your training..."
							}
							disabled={isLoading || (aiLimit ? !aiLimit.canCreate : false)}
						/>
					</PromptInputBody>
					<PromptInputToolbar>
						<PromptInputTools />
						<PromptInputSubmit
							status={status}
							disabled={isLoading || (aiLimit ? !aiLimit.canCreate : false)}
						/>
					</PromptInputToolbar>
				</PromptInput>
			</div>
		</div>
	)
}
