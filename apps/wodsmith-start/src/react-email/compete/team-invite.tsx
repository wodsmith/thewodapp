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

export interface CompetitionTeamInviteProps {
	recipientEmail?: string
	captainName?: string
	teamName?: string
	competitionName?: string
	competitionSlug?: string
	competitionDate?: string
	divisionName?: string
	currentRosterSize?: number
	maxRosterSize?: number
	inviteLink?: string
	registrationDeadline?: string
}

export const CompetitionTeamInviteEmail = ({
	recipientEmail = "user@example.com",
	captainName = "Team Captain",
	teamName = "Team",
	competitionName = "Competition",
	competitionSlug = "competition",
	competitionDate,
	divisionName = "Division",
	currentRosterSize = 1,
	maxRosterSize = 3,
	inviteLink = "https://example.com/accept-invite",
	registrationDeadline,
}: CompetitionTeamInviteProps) => {
	const competitionUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={preheader}>You&apos;re invited to compete!</Heading>
					<Text style={paragraph}>Hello,</Text>
					<Text style={paragraph}>
						<strong>{captainName}</strong> has invited you to join{" "}
						<strong>{teamName}</strong> for{" "}
						<Link href={competitionUrl} style={inlineLink}>
							{competitionName}
						</Link>
						.
					</Text>

					<Section style={detailsBox}>
						<Text style={detailsTitle}>Team Details</Text>
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
						<Text style={detailRow}>
							<strong>Team:</strong> {teamName}
						</Text>
						<Text style={detailRow}>
							<strong>Roster:</strong> {currentRosterSize} of {maxRosterSize}{" "}
							teammates confirmed
						</Text>
					</Section>

					{registrationDeadline && (
						<Section style={warningBox}>
							<Text style={warningText}>
								Registration closes {registrationDeadline}
							</Text>
						</Section>
					)}

					<Section style={buttonContainer}>
						<Link style={button} href={inviteLink}>
							Join Team
						</Link>
					</Section>

					<Text style={paragraph}>
						This invitation was sent to {recipientEmail}. If you don&apos;t have
						an account yet, you&apos;ll be able to create one when you accept.
					</Text>

					<Text style={paragraph}>
						If you&apos;re having trouble with the button above, copy and paste
						this URL into your browser:
					</Text>
					<Text style={link}>{inviteLink}</Text>

					<Text style={paragraph}>
						If you didn&apos;t expect this invitation, you can safely ignore
						this email.
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

CompetitionTeamInviteEmail.PreviewProps = {
	recipientEmail: "teammate@example.com",
	captainName: "John Smith",
	teamName: "Team Alpha",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	competitionDate: "March 15, 2025",
	divisionName: "RX Team of 3",
	currentRosterSize: 2,
	maxRosterSize: 3,
	inviteLink: "https://wodsmith.com/team-invite?token=abc123",
	registrationDeadline: "March 10, 2025",
} as CompetitionTeamInviteProps

export default CompetitionTeamInviteEmail

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
	maxWidth: "600px",
	margin: "20px auto 0",
	padding: "40px",
}

const preheader = {
	color: "#525f7f",
	fontSize: "18px",
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

const inlineLink = {
	color: "#556cd6",
	textDecoration: "underline",
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
	textAlign: "center" as const,
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

const link = {
	color: "#556cd6",
	fontSize: "14px",
	textAlign: "center" as const,
	textDecoration: "underline",
	margin: "16px 0 30px",
	wordBreak: "break-all" as const,
}

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	margin: "20px 0",
}
