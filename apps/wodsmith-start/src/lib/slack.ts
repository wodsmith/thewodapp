/**
 * Slack notification utilities for purchase notifications
 * Uses createServerOnlyFn to enforce server-only execution
 */

import { createServerOnlyFn } from "@tanstack/react-start"
import {
	getSlackPurchaseNotificationTypes,
	getSlackWebhookUrl,
	isSlackPurchaseNotificationsEnabled,
} from "@/lib/env"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"

/**
 * Purchase types that can trigger Slack notifications
 */
export const SLACK_PURCHASE_TYPES = {
	COMPETITION_REGISTRATION: "COMPETITION_REGISTRATION",
	ADDON: "ADDON",
	CREDITS: "CREDITS",
	SUBSCRIPTION: "SUBSCRIPTION",
} as const

export type SlackPurchaseType =
	(typeof SLACK_PURCHASE_TYPES)[keyof typeof SLACK_PURCHASE_TYPES]

/**
 * Configuration for which purchase types should trigger notifications
 */
export interface SlackNotificationConfig {
	enabled: boolean
	purchaseTypes: SlackPurchaseType[]
}

/**
 * Data structure for purchase notifications
 */
export interface PurchaseNotificationData {
	type: SlackPurchaseType
	amountCents: number
	customerEmail?: string
	customerName?: string
	productName?: string
	competitionName?: string
	divisionName?: string
	teamName?: string
	purchaseId?: string
	metadata?: Record<string, string>
}

/**
 * Get the enabled purchase types for Slack notifications.
 * Parses the raw comma-separated env var into validated types.
 * Defaults to all types if not specified.
 */
function getEnabledPurchaseTypes(): SlackPurchaseType[] {
	const typesEnv = getSlackPurchaseNotificationTypes()

	if (!typesEnv) {
		return Object.values(SLACK_PURCHASE_TYPES)
	}

	const types = typesEnv
		.split(",")
		.map((t) => t.trim().toUpperCase())
		.filter((t) =>
			Object.values(SLACK_PURCHASE_TYPES).includes(t as SlackPurchaseType),
		) as SlackPurchaseType[]

	return types.length > 0 ? types : Object.values(SLACK_PURCHASE_TYPES)
}

/**
 * Escape special characters for Slack mrkdwn format
 */
function escapeSlackMrkdwn(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Format currency from cents to dollars
 */
function formatCurrency(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

/**
 * Get emoji for purchase type
 */
function getPurchaseEmoji(type: SlackPurchaseType): string {
	switch (type) {
		case SLACK_PURCHASE_TYPES.COMPETITION_REGISTRATION:
			return ":trophy:"
		case SLACK_PURCHASE_TYPES.ADDON:
			return ":package:"
		case SLACK_PURCHASE_TYPES.CREDITS:
			return ":coin:"
		case SLACK_PURCHASE_TYPES.SUBSCRIPTION:
			return ":star:"
		default:
			return ":moneybag:"
	}
}

/**
 * Get friendly name for purchase type
 */
function getPurchaseTypeName(type: SlackPurchaseType): string {
	switch (type) {
		case SLACK_PURCHASE_TYPES.COMPETITION_REGISTRATION:
			return "Competition Registration"
		case SLACK_PURCHASE_TYPES.ADDON:
			return "Add-on"
		case SLACK_PURCHASE_TYPES.CREDITS:
			return "Credits"
		case SLACK_PURCHASE_TYPES.SUBSCRIPTION:
			return "Subscription"
		default:
			return "Purchase"
	}
}

/**
 * Build Slack message blocks for a purchase notification
 */
function buildPurchaseMessage(data: PurchaseNotificationData): {
	text: string
	blocks: object[]
} {
	const emoji = getPurchaseEmoji(data.type)
	const typeName = getPurchaseTypeName(data.type)
	const amount = formatCurrency(data.amountCents)

	const headerText = `${emoji} New ${typeName}: ${amount}`

	const fields: Array<{ type: string; text: string }> = []

	// Add customer info
	if (data.customerName || data.customerEmail) {
		fields.push({
			type: "mrkdwn",
			text: `*Customer:*\n${escapeSlackMrkdwn(data.customerName || "Unknown")}${data.customerEmail ? `\n${escapeSlackMrkdwn(data.customerEmail)}` : ""}`,
		})
	}

	// Add amount
	fields.push({
		type: "mrkdwn",
		text: `*Amount:*\n${amount}`,
	})

	// Add competition details if applicable
	if (data.competitionName) {
		fields.push({
			type: "mrkdwn",
			text: `*Competition:*\n${escapeSlackMrkdwn(data.competitionName)}`,
		})
	}

	if (data.divisionName) {
		fields.push({
			type: "mrkdwn",
			text: `*Division:*\n${escapeSlackMrkdwn(data.divisionName)}`,
		})
	}

	// Add team name if applicable
	if (data.teamName) {
		fields.push({
			type: "mrkdwn",
			text: `*Team:*\n${escapeSlackMrkdwn(data.teamName)}`,
		})
	}

	// Add product name if specified
	if (data.productName) {
		fields.push({
			type: "mrkdwn",
			text: `*Product:*\n${escapeSlackMrkdwn(data.productName)}`,
		})
	}

	const blocks: object[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: headerText,
				emoji: true,
			},
		},
		{
			type: "section",
			fields: fields,
		},
	]

	// Add purchase ID as context if available
	if (data.purchaseId) {
		blocks.push({
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: `Purchase ID: \`${data.purchaseId}\``,
				},
			],
		})
	}

	// Add metadata as additional context if provided
	if (data.metadata && Object.keys(data.metadata).length > 0) {
		const metadataText = Object.entries(data.metadata)
			.map(
				([key, value]) =>
					`${escapeSlackMrkdwn(key)}: ${escapeSlackMrkdwn(value)}`,
			)
			.join(" | ")

		blocks.push({
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: metadataText,
				},
			],
		})
	}

	return {
		text: headerText, // Fallback for notifications
		blocks,
	}
}

/**
 * Send a purchase notification to Slack.
 * This is a server-only function.
 *
 * Returns true if notification was sent successfully, false otherwise.
 * Does not throw errors to avoid disrupting the main purchase flow.
 */
export const sendPurchaseNotification = createServerOnlyFn(
	async (data: PurchaseNotificationData): Promise<boolean> => {
		// Check if notifications are enabled
		if (!isSlackPurchaseNotificationsEnabled()) {
			logInfo({
				message: "[Slack] Purchase notifications disabled, skipping",
				attributes: { purchaseType: data.type },
			})
			return false
		}

		// Check if this purchase type is enabled
		const enabledTypes = getEnabledPurchaseTypes()
		if (!enabledTypes.includes(data.type)) {
			logInfo({
				message: "[Slack] Purchase type not enabled for notifications",
				attributes: {
					purchaseType: data.type,
					enabledTypes: enabledTypes.join(", "),
				},
			})
			return false
		}

		// Get webhook URL
		const webhookUrl = getSlackWebhookUrl()
		if (!webhookUrl) {
			logWarning({
				message: "[Slack] No webhook URL configured, skipping notification",
			})
			return false
		}

		try {
			const message = buildPurchaseMessage(data)

			const response = await fetch(webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(message),
			})

			if (!response.ok) {
				const responseText = await response.text()
				logError({
					message: "[Slack] Failed to send purchase notification",
					attributes: {
						status: response.status,
						statusText: response.statusText,
						response: responseText,
						purchaseType: data.type,
					},
				})
				return false
			}

			logInfo({
				message: "[Slack] Purchase notification sent successfully",
				attributes: {
					purchaseType: data.type,
					amountCents: data.amountCents,
				},
			})
			return true
		} catch (error) {
			logError({
				message: "[Slack] Error sending purchase notification",
				error: error instanceof Error ? error : new Error(String(error)),
				attributes: { purchaseType: data.type },
			})
			return false
		}
	},
)

/**
 * Convenience function to send a competition registration notification
 */
export const notifyCompetitionRegistration = createServerOnlyFn(
	async (params: {
		amountCents: number
		customerEmail?: string
		customerName?: string
		competitionName: string
		divisionName?: string
		teamName?: string
		purchaseId?: string
	}): Promise<boolean> => {
		return sendPurchaseNotification({
			type: SLACK_PURCHASE_TYPES.COMPETITION_REGISTRATION,
			...params,
		})
	},
)

/**
 * Convenience function to send an addon purchase notification
 */
export const notifyAddonPurchase = createServerOnlyFn(
	async (params: {
		amountCents: number
		customerEmail?: string
		customerName?: string
		productName: string
		purchaseId?: string
	}): Promise<boolean> => {
		return sendPurchaseNotification({
			type: SLACK_PURCHASE_TYPES.ADDON,
			...params,
		})
	},
)

/**
 * Convenience function to send a credits purchase notification
 */
export const notifyCreditsPurchase = createServerOnlyFn(
	async (params: {
		amountCents: number
		customerEmail?: string
		customerName?: string
		creditAmount?: number
		purchaseId?: string
	}): Promise<boolean> => {
		return sendPurchaseNotification({
			type: SLACK_PURCHASE_TYPES.CREDITS,
			...params,
			productName: params.creditAmount
				? `${params.creditAmount} credits`
				: "Credits",
		})
	},
)

/**
 * Convenience function to send a subscription purchase notification
 */
export const notifySubscriptionPurchase = createServerOnlyFn(
	async (params: {
		amountCents: number
		customerEmail?: string
		customerName?: string
		planName: string
		purchaseId?: string
	}): Promise<boolean> => {
		return sendPurchaseNotification({
			type: SLACK_PURCHASE_TYPES.SUBSCRIPTION,
			...params,
			productName: params.planName,
		})
	},
)
