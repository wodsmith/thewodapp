/**
 * AI utilities for Cloudflare Workers environment.
 *
 * These utilities handle the Cloudflare-specific env access
 * for AI SDK providers.
 */

import { createOpenAI } from "@ai-sdk/openai"
import { env } from "cloudflare:workers"

/**
 * Model size options for AI agents.
 * - large: Most capable, highest cost (e.g., gpt-5.2)
 * - medium: Balanced capability and cost (e.g., gpt-5-mini)
 * - small: Fastest, lowest cost (e.g., gpt-5-nano)
 */
export type ModelSize = "large" | "medium" | "small"

/**
 * Default model IDs for each size tier.
 * Can be overridden via environment variables.
 */
const DEFAULT_MODELS: Record<ModelSize, string> = {
	large: "gpt-5.2",
	medium: "gpt-5-mini",
	small: "gpt-5-nano",
}

/**
 * Gets the model ID for a given size tier.
 * Reads from environment variables first, falls back to defaults.
 *
 * Environment variables:
 * - OPENAI_MODEL_LARGE: Large model ID
 * - OPENAI_MODEL_MEDIUM: Medium model ID
 * - OPENAI_MODEL_SMALL: Small model ID
 */
function getModelId(size: ModelSize): string {
	switch (size) {
		case "large":
			return env.OPENAI_MODEL_LARGE || DEFAULT_MODELS.large
		case "medium":
			return env.OPENAI_MODEL_MEDIUM || DEFAULT_MODELS.medium
		case "small":
			return env.OPENAI_MODEL_SMALL || DEFAULT_MODELS.small
	}
}

/**
 * Creates an OpenAI model configured for Cloudflare Workers.
 *
 * This reads the API key from Cloudflare's env at request time,
 * which is required because process.env isn't available in Workers.
 *
 * @param size - Model size: "large", "medium", or "small" (default: "medium")
 * @returns OpenAI language model instance
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   model: () => getOpenAIModel("medium"),
 * })
 * ```
 */
export function getOpenAIModel(size: ModelSize = "medium") {
	const openai = createOpenAI({
		apiKey: env.OPENAI_API_KEY,
	})
	return openai(getModelId(size))
}
