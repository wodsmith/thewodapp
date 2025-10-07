"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { MessageCircle } from "lucide-react"
import { useState } from "react"
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

export default function ChatPage() {
	const [input, setInput] = useState("")
	const { messages, sendMessage, status } = useChat({
		transport: new DefaultChatTransport({ api: "/api/chat" }),
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
							placeholder="Ask me anything about your training..."
							disabled={isLoading}
						/>
					</PromptInputBody>
					<PromptInputToolbar>
						<PromptInputTools />
						<PromptInputSubmit status={status} disabled={isLoading} />
					</PromptInputToolbar>
				</PromptInput>
			</div>
		</div>
	)
}
