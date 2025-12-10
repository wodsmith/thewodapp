import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Section,
	Text,
} from "@react-email/components"
import { SITE_DOMAIN } from "@/constants"

export interface RegistrationConfirmationProps {
	athleteName?: string
	competitionName?: string
	competitionSlug?: string
	registrationId?: string
	competitionDate?: string
	divisionName?: string
	teamName?: string
	pendingTeammateCount?: number
	isPaid?: boolean
	amountPaidFormatted?: string
}

export const RegistrationConfirmationEmail = ({
	athleteName = "Athlete",
	competitionName = "Competition",
	competitionSlug = "competition",
	registrationId = "creg_example",
	competitionDate,
	divisionName = "Division",
	teamName,
	pendingTeammateCount,
	isPaid = false,
	amountPaidFormatted,
}: RegistrationConfirmationProps) => {
	const registrationUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}/teams/${registrationId}`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>Registration Confirmed!</Heading>
					<Text style={paragraph}>Hi {athleteName},</Text>
					<Text style={paragraph}>
						You&apos;re registered for <strong>{competitionName}</strong>!
					</Text>

					<Section style={detailsBox}>
						<Text style={detailsTitle}>Registration Details</Text>
						<Text style={detailRow}>
							<strong>Competition:</strong> {competitionName}
						</Text>
						{competitionDate && (
							<Text style={detailRow}>
								<strong>Date:</strong> {competitionDate}
							</Text>
						)}
						<Text style={detailRow}>
							<strong>Division:</strong> {divisionName}
						</Text>
						{teamName && (
							<Text style={detailRow}>
								<strong>Team:</strong> {teamName}
							</Text>
						)}
						{isPaid && amountPaidFormatted && (
							<Text style={detailRow}>
								<strong>Amount Paid:</strong> {amountPaidFormatted}
							</Text>
						)}
					</Section>

					{pendingTeammateCount !== undefined && pendingTeammateCount > 0 && (
						<Section style={warningBox}>
							<Text style={warningText}>
								⚠️ You have {pendingTeammateCount} pending teammate{" "}
								{pendingTeammateCount === 1 ? "invitation" : "invitations"}.
								Your team won&apos;t be complete until they accept.
							</Text>
						</Section>
					)}

					<Section style={buttonContainer}>
						<Link style={button} href={registrationUrl}>
							View Registration
						</Link>
					</Section>

					<Text style={paragraph}>
						If you have any questions, please contact the competition organizer.
					</Text>
				</Container>
				<Text style={footer}>
					This is an automated message from {SITE_DOMAIN}. Please do not reply
					to this email.
				</Text>
			</Body>
		</Html>
	)
}

RegistrationConfirmationEmail.PreviewProps = {
	athleteName: "John Smith",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	registrationId: "creg_mbwft7k18l8niqu9s39zv1hf",
	competitionDate: "March 15, 2025",
	divisionName: "RX Male",
	teamName: "Team Alpha",
	pendingTeammateCount: 2,
	isPaid: true,
	amountPaidFormatted: "$50.00",
} as RegistrationConfirmationProps

export default RegistrationConfirmationEmail

const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
	marginTop: "30px",
}

const container = {
	backgroundColor: "#ffffff",
	border: "1px solid #f0f0f0",
	borderRadius: "5px",
	boxShadow: "0 5px 10px rgba(20,50,70,.2)",
	marginTop: "20px",
	maxWidth: "600px",
	margin: "0 auto",
	padding: "40px",
}

const preheader = {
	color: "#22c55e",
	fontSize: "24px",
	textAlign: "center" as const,
	marginBottom: "30px",
}

const paragraph = {
	color: "#525f7f",
	fontSize: "16px",
	lineHeight: "24px",
	textAlign: "left" as const,
	marginBottom: "16px",
}

const detailsBox = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "5px",
	padding: "20px",
	marginBottom: "24px",
}

const detailsTitle = {
	color: "#1e293b",
	fontSize: "14px",
	fontWeight: "bold" as const,
	textTransform: "uppercase" as const,
	letterSpacing: "0.5px",
	marginBottom: "12px",
	marginTop: "0",
}

const detailRow = {
	color: "#525f7f",
	fontSize: "15px",
	lineHeight: "20px",
	margin: "8px 0",
}

const warningBox = {
	backgroundColor: "#fef3c7",
	border: "1px solid #f59e0b",
	borderRadius: "5px",
	padding: "16px",
	marginBottom: "24px",
}

const warningText = {
	color: "#92400e",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0",
}

const buttonContainer = {
	textAlign: "center" as const,
	margin: "30px 0",
}

const button = {
	backgroundColor: "#000",
	borderRadius: "5px",
	color: "#fff",
	display: "inline-block",
	fontSize: "16px",
	fontWeight: "bold",
	textDecoration: "none",
	textAlign: "center" as const,
	padding: "13px 40px",
	margin: "0 auto",
}

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	margin: "20px 0",
}
