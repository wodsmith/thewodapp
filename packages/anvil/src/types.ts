/**
 * Metadata attached to each message in the chat session
 */
export interface MessageMetadata {
  /**
   * Timestamp when the message was created
   */
  timestamp: number;
  /**
   * Optional model identifier used to generate the response
   */
  model?: string;
  /**
   * Optional token usage information
   */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Represents the state of a chat conversation
 */
export interface ChatState {
  /**
   * Array of messages in the conversation
   */
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    metadata?: MessageMetadata;
  }>;
  /**
   * Optional conversation context or system prompt
   */
  context?: string;
  /**
   * Unique identifier for the chat session
   */
  sessionId?: string;
}

/**
 * Configuration options for the ChatAgent
 */
export interface ChatAgentConfig {
  /**
   * The AI model to use (e.g., "gpt-4", "gpt-3.5-turbo")
   */
  model: string;
  /**
   * Optional OpenAI API key (uses env var if not provided)
   */
  apiKey?: string;
  /**
   * Optional system prompt to set context for the conversation
   */
  systemPrompt?: string;
  /**
   * Optional temperature setting (0-2, default 1)
   */
  temperature?: number;
  /**
   * Optional max tokens for responses
   */
  maxTokens?: number;
}
