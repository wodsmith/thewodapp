import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { InvoiceDetails } from "@/server/commerce/purchases"

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontSize: 10,
		fontFamily: "Helvetica",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 30,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
	},
	badge: {
		backgroundColor: "#22c55e",
		color: "white",
		padding: "4 8",
		borderRadius: 4,
		fontSize: 10,
	},
	badgePending: {
		backgroundColor: "#6b7280",
	},
	badgeFailed: {
		backgroundColor: "#ef4444",
	},
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: "bold",
		marginBottom: 8,
		color: "#374151",
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 4,
	},
	label: {
		color: "#6b7280",
	},
	value: {
		fontWeight: "bold",
	},
	divider: {
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		marginVertical: 12,
	},
	lineItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 6,
	},
	lineItemFee: {
		color: "#6b7280",
		fontSize: 9,
	},
	total: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 8,
		fontSize: 14,
		fontWeight: "bold",
	},
	footer: {
		position: "absolute",
		bottom: 40,
		left: 40,
		right: 40,
		textAlign: "center",
		color: "#9ca3af",
		fontSize: 8,
	},
	infoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 20,
	},
	infoItem: {
		width: "45%",
		marginBottom: 12,
	},
	infoLabel: {
		color: "#6b7280",
		fontSize: 9,
		marginBottom: 2,
	},
	infoValue: {
		fontSize: 10,
	},
	invoiceId: {
		fontFamily: "Courier",
		fontSize: 8,
	},
	companyName: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 4,
	},
	eventName: {
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 4,
	},
	organizerName: {
		color: "#6b7280",
		fontSize: 10,
	},
})

function formatCurrency(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100)
}

function formatDate(date: Date | null): string {
	if (!date) return "-"
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(new Date(date))
}

function capitalizeFirst(str: string | null): string {
	if (!str) return ""
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

type InvoicePDFProps = {
	invoice: InvoiceDetails
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
	const registrationFee =
		invoice.totalCents - invoice.platformFeeCents - invoice.stripeFeeCents

	const getBadgeStyle = () => {
		switch (invoice.status) {
			case "PENDING":
				return [styles.badge, styles.badgePending]
			case "FAILED":
			case "CANCELLED":
				return [styles.badge, styles.badgeFailed]
			default:
				return styles.badge
		}
	}

	const statusText = invoice.status === "COMPLETED" ? "PAID" : invoice.status

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<View>
						<Text style={styles.title}>Invoice</Text>
					</View>
					<View style={getBadgeStyle()}>
						<Text>{statusText}</Text>
					</View>
				</View>

				{/* Event Info */}
				<View style={styles.section}>
					<Text style={styles.eventName}>
						{invoice.competition?.name ?? invoice.product.name}
					</Text>
					{invoice.competition?.organizingTeam && (
						<Text style={styles.organizerName}>
							{invoice.competition.organizingTeam.name}
						</Text>
					)}
				</View>

				{/* Invoice Details */}
				<View style={styles.section}>
					<View style={styles.infoGrid}>
						<View style={styles.infoItem}>
							<Text style={styles.infoLabel}>Invoice ID</Text>
							<Text style={styles.invoiceId}>{invoice.id}</Text>
						</View>
						<View style={styles.infoItem}>
							<Text style={styles.infoLabel}>Date</Text>
							<Text style={styles.infoValue}>
								{formatDate(invoice.completedAt ?? invoice.createdAt)}
							</Text>
						</View>
						<View style={styles.infoItem}>
							<Text style={styles.infoLabel}>Bill To</Text>
							<Text style={styles.infoValue}>
								{invoice.user.firstName} {invoice.user.lastName}
							</Text>
							<Text style={[styles.infoValue, { color: "#6b7280" }]}>
								{invoice.user.email}
							</Text>
						</View>
						{invoice.competition?.startDate && (
							<View style={styles.infoItem}>
								<Text style={styles.infoLabel}>Event Date</Text>
								<Text style={styles.infoValue}>
									{formatDate(invoice.competition.startDate)}
								</Text>
							</View>
						)}
					</View>
				</View>

				<View style={styles.divider} />

				{/* Line Items */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Items</Text>

					{/* Registration Fee */}
					<View style={styles.lineItem}>
						<Text>{invoice.product.name}</Text>
						<Text>{formatCurrency(registrationFee)}</Text>
					</View>

					{/* Platform Fee */}
					{invoice.platformFeeCents > 0 && (
						<View style={styles.lineItem}>
							<Text style={styles.lineItemFee}>Platform Fee</Text>
							<Text style={styles.lineItemFee}>
								{formatCurrency(invoice.platformFeeCents)}
							</Text>
						</View>
					)}

					{/* Payment Processing Fee */}
					{invoice.stripeFeeCents > 0 && (
						<View style={styles.lineItem}>
							<Text style={styles.lineItemFee}>Payment Processing Fee</Text>
							<Text style={styles.lineItemFee}>
								{formatCurrency(invoice.stripeFeeCents)}
							</Text>
						</View>
					)}
				</View>

				<View style={styles.divider} />

				{/* Total */}
				<View style={styles.total}>
					<Text>Total</Text>
					<Text>{formatCurrency(invoice.totalCents)}</Text>
				</View>

				{/* Payment Method */}
				{invoice.stripe && invoice.status === "COMPLETED" && (
					<View style={[styles.section, { marginTop: 20 }]}>
						<Text style={styles.infoLabel}>Payment Method</Text>
						<Text style={styles.infoValue}>
							{capitalizeFirst(
								invoice.stripe.brand ?? invoice.stripe.paymentMethod,
							)}
							{invoice.stripe.last4 && ` ending in ${invoice.stripe.last4}`}
						</Text>
					</View>
				)}

				{/* Footer */}
				<Text style={styles.footer}>
					Generated by WODsmith | Thank you for your purchase
				</Text>
			</Page>
		</Document>
	)
}
