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

export interface CompetitionInviteEmailProps {
	championshipName: string
	divisionLabel: string
	claimUrl: string
	declineUrl: string
	athleteName: string
	organizerTeamName: string
	subject?: string
	bodyText?: string
	rsvpDeadlineLabel?: string
	sourceLabel?: string | null
}

export const CompetitionInviteEmail = ({
	championshipName,
	divisionLabel,
	claimUrl,
	declineUrl,
	athleteName,
	organizerTeamName,
	subject,
	bodyText,
	rsvpDeadlineLabel,
	sourceLabel,
}: CompetitionInviteEmailProps) => {
	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Text style={fromLine}>
						From <strong>{organizerTeamName}</strong> &middot; {championshipName}
					</Text>

					<Heading style={heading}>
						{subject ?? `You're invited to ${championshipName}`}
					</Heading>

					<Section style={bodySection}>
						<Text style={bodyTextStyle}>
							Hi {athleteName},
						</Text>
						<Text style={bodyTextStyle}>
							{bodyText ??
								`You've earned a spot at ${championshipName}. This invitation is locked to your email — only you can claim it. Continue below to confirm your spot and complete registration.`}
						</Text>
					</Section>

					<Section style={detailSection}>
						<Text style={detailRow}>
							<strong>Division:</strong> {divisionLabel}
						</Text>
						{sourceLabel ? (
							<Text style={detailRow}>
								<strong>Qualified via:</strong> {sourceLabel}
							</Text>
						) : null}
						{rsvpDeadlineLabel ? (
							<Text style={detailRow}>
								<strong>Respond by:</strong> {rsvpDeadlineLabel}
							</Text>
						) : null}
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={claimUrl}>
							Claim your spot
						</Link>
					</Section>

					<Text style={paragraph}>
						Can't compete?{" "}
						<Link href={declineUrl} style={declineLink}>
							Decline the invitation
						</Link>
						.
					</Text>

					<Text style={paragraph}>
						This invitation is bound to your email and can't be forwarded — the
						link will only work while you're signed in as{" "}
						<strong>{athleteName}</strong>.
					</Text>
				</Container>
				<Text style={footer}>
					This is an automated message from WODsmith. Reply to the organizer at{" "}
					{organizerTeamName} with any questions.
				</Text>
			</Body>
		</Html>
	)
}

CompetitionInviteEmail.PreviewProps = {
	championshipName: "2026 WODsmith Invitational",
	divisionLabel: "Men's RX",
	claimUrl: "https://app.wodsmith.com/compete/2026-wodsmith-invitational/claim/abc",
	declineUrl:
		"https://app.wodsmith.com/compete/2026-wodsmith-invitational/claim/abc/decline",
	athleteName: "Mike",
	organizerTeamName: "Mountain West Fitness Collective",
	rsvpDeadlineLabel: "May 1, 2026",
	sourceLabel: "1st — Regional Qualifier",
} as CompetitionInviteEmailProps

export default CompetitionInviteEmail

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
	margin: "20px auto",
	padding: "40px",
}

const fromLine = {
	color: "#8898aa",
	fontSize: "13px",
	lineHeight: "20px",
	marginBottom: "8px",
}

const heading = {
	color: "#1e293b",
	fontSize: "22px",
	lineHeight: "30px",
	marginBottom: "24px",
}

const bodySection = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "5px",
	padding: "20px",
	marginBottom: "16px",
}

const bodyTextStyle = {
	color: "#334155",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 12px 0",
	whiteSpace: "pre-wrap" as const,
}

const detailSection = {
	padding: "12px 20px",
	marginBottom: "16px",
	borderLeft: "3px solid #0ea5e9",
}

const detailRow = {
	color: "#334155",
	fontSize: "14px",
	lineHeight: "22px",
	margin: "0",
}

const buttonContainer = {
	textAlign: "center" as const,
	margin: "30px 0",
}

const button = {
	backgroundColor: "#0ea5e9",
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

const paragraph = {
	color: "#525f7f",
	fontSize: "14px",
	lineHeight: "20px",
	textAlign: "left" as const,
	marginBottom: "16px",
}

const declineLink = {
	color: "#64748b",
	textDecoration: "underline",
}

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	margin: "20px 0",
}
