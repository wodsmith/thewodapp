import {
	FINANCIAL_EVENT_TYPE,
	type FinancialEventType,
} from "@/db/ps-schema"
import { cn } from "@/utils/cn"

const greenTypes = new Set<FinancialEventType>([
	FINANCIAL_EVENT_TYPE.PAYMENT_COMPLETED,
	FINANCIAL_EVENT_TYPE.PAYOUT_COMPLETED,
	FINANCIAL_EVENT_TYPE.DISPUTE_WON,
])

const redTypes = new Set<FinancialEventType>([
	FINANCIAL_EVENT_TYPE.REFUND_COMPLETED,
	FINANCIAL_EVENT_TYPE.DISPUTE_OPENED,
	FINANCIAL_EVENT_TYPE.DISPUTE_LOST,
	FINANCIAL_EVENT_TYPE.PAYMENT_FAILED,
	FINANCIAL_EVENT_TYPE.REFUND_FAILED,
	FINANCIAL_EVENT_TYPE.PAYOUT_FAILED,
])

const amberTypes = new Set<FinancialEventType>([
	FINANCIAL_EVENT_TYPE.REFUND_INITIATED,
	FINANCIAL_EVENT_TYPE.PAYOUT_INITIATED,
])

function getColorClasses(eventType: FinancialEventType): string {
	if (greenTypes.has(eventType)) {
		return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
	}
	if (redTypes.has(eventType)) {
		return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
	}
	if (amberTypes.has(eventType)) {
		return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
	}
	return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
}

function formatLabel(eventType: string): string {
	return eventType
		.split("_")
		.map((word) => word.charAt(0) + word.slice(1).toLowerCase())
		.join(" ")
}

interface EventTypeBadgeProps {
	eventType: FinancialEventType
	className?: string
}

export function EventTypeBadge({ eventType, className }: EventTypeBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
				getColorClasses(eventType),
				className,
			)}
		>
			{formatLabel(eventType)}
		</span>
	)
}
