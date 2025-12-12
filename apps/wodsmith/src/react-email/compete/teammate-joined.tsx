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

export interface TeammateJoinedProps {
	captainName?: string
	newTeammateName?: string
	teamName?: string
	competitionName?: string
	competitionSlug?: string
	currentRosterSize?: number
	maxRosterSize?: number
	isTeamComplete?: boolean
}

export const TeammateJoinedEmail = ({
	captainName = "Captain",
	newTeammateName = "Teammate",
	teamName = "Team",
	competitionName = "Competition",
	competitionSlug = "competition",
	currentRosterSize = 2,
	maxRosterSize = 3,
	isTeamComplete = false,
}: TeammateJoinedProps) => {
	const teamUrl = `https://${SITE_DOMAIN}/compete/${competitionSlug}/my-registration`

	return (
		<Html>
			<Head />
			<Body style={main}>
				<Container style={container}>
					<Heading style={isTeamComplete ? preheaderSuccess : preheader}>
						{isTeamComplete
							? "🎉 Your team is complete!"
							: "Teammate joined your team"}
					</Heading>
					<Text style={paragraph}>Hi {captainName},</Text>
					<Text style={paragraph}>
						<strong>{newTeammateName}</strong> has joined{" "}
						<strong>{teamName}</strong> for {competitionName}.
					</Text>

					<Section style={isTeamComplete ? successBox : detailsBox}>
						<Text style={isTeamComplete ? successTitle : detailsTitle}>
							Roster Status
						</Text>
						<Text style={rosterStatus}>
							{currentRosterSize} of {maxRosterSize} teammates confirmed
						</Text>
						{isTeamComplete ? (
							<Text style={successText}>
								Your team is ready to compete! Good luck!
							</Text>
						) : (
							<Text style={detailRow}>
								{maxRosterSize - currentRosterSize} more teammate
								{maxRosterSize - currentRosterSize === 1 ? "" : "s"} needed
							</Text>
						)}
					</Section>

					<Section style={buttonContainer}>
						<Link style={button} href={teamUrl}>
							View Team
						</Link>
					</Section>
				</Container>
				<Text style={footer}>
					This is an automated message from {SITE_DOMAIN}. Please do not reply
					to this email.
				</Text>
			</Body>
		</Html>
	)
}

TeammateJoinedEmail.PreviewProps = {
	captainName: "John Smith",
	newTeammateName: "Jane Doe",
	teamName: "Team Alpha",
	competitionName: "CrossFit Open 2025",
	competitionSlug: "crossfit-open-2025",
	currentRosterSize: 3,
	maxRosterSize: 3,
	isTeamComplete: true,
} as TeammateJoinedProps

export default TeammateJoinedEmail

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
	color: "#525f7f",
	fontSize: "18px",
	textAlign: "center" as const,
	marginBottom: "30px",
}

const preheaderSuccess = {
	color: "#22c55e",
	fontSize: "20px",
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
	textAlign: "center" as const,
}

const successBox = {
	backgroundColor: "#dcfce7",
	border: "1px solid #22c55e",
	borderRadius: "5px",
	padding: "20px",
	marginBottom: "24px",
	textAlign: "center" as const,
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

const successTitle = {
	color: "#166534",
	fontSize: "14px",
	fontWeight: "bold" as const,
	textTransform: "uppercase" as const,
	letterSpacing: "0.5px",
	marginBottom: "12px",
	marginTop: "0",
}

const rosterStatus = {
	color: "#1e293b",
	fontSize: "24px",
	fontWeight: "bold" as const,
	margin: "8px 0",
}

const detailRow = {
	color: "#525f7f",
	fontSize: "15px",
	lineHeight: "20px",
	margin: "8px 0",
}

const successText = {
	color: "#166534",
	fontSize: "15px",
	lineHeight: "20px",
	margin: "8px 0",
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
