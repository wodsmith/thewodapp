/**
 * @repo/anvil - AI chat agent wrapper for Cloudflare Agents + Vercel AI SDK
 * 
 * This package provides a unified interface for creating chat agents
 * that work with Cloudflare Agents framework and Vercel AI SDK.
 */

// Export the main ChatAgent class
export { ChatAgent } from "./agent";

// Export all types
export type {
  ChatAgentConfig,
  ChatState,
  MessageMetadata,
} from "./types";
