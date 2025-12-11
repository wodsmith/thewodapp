import { AIChatAgent } from "agents/ai-chat-agent";
import type { AgentContext } from "agents";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  type StreamTextOnFinishCallback,
  type ToolSet,
} from "ai";
import type { ChatAgentConfig, ChatState, MessageMetadata } from "./types";

/**
 * ChatAgent class that extends Cloudflare's AIChatAgent
 * Provides streaming chat responses with OpenAI using Vercel AI SDK
 */
export class ChatAgent<Env = unknown> extends AIChatAgent<Env, ChatState> {
  private config: ChatAgentConfig;

  constructor(ctx: AgentContext, env: Env, config: ChatAgentConfig) {
    super(ctx, env);
    this.config = config;
  }

  /**
   * Handles incoming chat messages and returns a streaming response
   * Supports tool calling and maintains chat history in state
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: {
      abortSignal: AbortSignal | undefined;
    }
  ): Promise<Response | undefined> {
    // Get current state (messages, tools, etc.)
    const state = this.state || ({ messages: [] } as ChatState);
    const tools = (state as ChatState & { tools?: ToolSet }).tools;

    // Convert UIMessages to model messages
    const messages = convertToModelMessages(this.messages);

    // Prepend system prompt if configured
    const messagesWithSystem = this.config.systemPrompt
      ? [
          { role: "system" as const, content: this.config.systemPrompt },
          ...messages,
        ]
      : messages;

    // Build streamText options
    const streamOptions: Parameters<typeof streamText>[0] = {
      model: openai(this.config.model || "gpt-4o") as any,
      messages: messagesWithSystem,
      tools: tools,
      abortSignal: options?.abortSignal,
      onFinish: async (event) => {
        // Add metadata to state for tracking
        const metadata: MessageMetadata = {
          timestamp: Date.now(),
          model: this.config.model,
          tokens: {
            prompt: event.usage.inputTokens || 0,
            completion: event.usage.outputTokens || 0,
            total: (event.usage.inputTokens || 0) + (event.usage.outputTokens || 0),
          },
        };

        // Store metadata in state for analytics/tracking
        await this.setState({
          ...state,
          messages: state.messages || [],
          context: state.context,
          sessionId: state.sessionId,
          lastMessageMetadata: metadata,
        } as ChatState & { lastMessageMetadata?: MessageMetadata });

        // Call the required onFinish callback
        await onFinish(event);
      },
    };

    // Add optional temperature if configured
    if (this.config.temperature !== undefined) {
      (streamOptions as any).temperature = this.config.temperature;
    }

    // Add optional maxTokens if configured (mapped to maxOutputTokens in v5)
    if (this.config.maxTokens !== undefined) {
      (streamOptions as any).maxOutputTokens = this.config.maxTokens;
    }

    const result = streamText(streamOptions);

    // Return the UI message stream response
    return result.toUIMessageStreamResponse();
  }

  /**
   * Get the current chat history from the built-in messages property
   */
  getChatHistory() {
    return this.messages || [];
  }

  /**
   * Get metadata from the last message
   */
  getLastMessageMetadata(): MessageMetadata | undefined {
    const state = this.state as
      | (ChatState & { lastMessageMetadata?: MessageMetadata })
      | undefined;
    return state?.lastMessageMetadata;
  }

  /**
   * Update the session context
   */
  async updateContext(context: string): Promise<void> {
    const state = this.state || ({ messages: [] } as ChatState);
    await this.setState({
      ...state,
      context,
    });
  }

  /**
   * Set or update the session ID
   */
  async setSessionId(sessionId: string): Promise<void> {
    const state = this.state || ({ messages: [] } as ChatState);
    await this.setState({
      ...state,
      sessionId,
    });
  }
}
