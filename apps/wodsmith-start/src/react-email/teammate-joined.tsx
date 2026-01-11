import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Section,
	Text,
} from "@react-email/components"
import { SITE_DOMAIN } from "@/constants"
import * as styles from "./styles"

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
			<Body style={styles.main}>
				<Container style={styles.container}>
					<Text style={styles.logo}>WODsmith</Text>

					<Heading style={styles.heading}>
						{isTeamComplete ? "Your team is complete!" : "Teammate joined"}
					</Heading>

					<Text style={styles.paragraph}>
						Hi {captainName}, <strong>{newTeammateName}</strong> joined{" "}
						<strong>{teamName}</strong> for {competitionName}.
					</Text>

					{isTeamComplete ? (
						<Section style={styles.successBox}>
							<Text style={styles.boxText}>
								<strong>
									{currentRosterSize}/{maxRosterSize} confirmed
								</strong>{" "}
								— Your team is ready to compete!
							</Text>
						</Section>
					) : (
						<Section style={styles.infoBox}>
							<Text style={{ ...styles.boxText, margin: 0 }}>
								<strong>
									{currentRosterSize}/{maxRosterSize} confirmed
								</strong>{" "}
								— {maxRosterSize - currentRosterSize} more needed
							</Text>
						</Section>
					)}

					<Section style={styles.buttonContainer}>
						<Link style={styles.button} href={teamUrl}>
							View Team
						</Link>
					</Section>

					<Hr style={styles.hr} />

					<Text style={styles.footer}>
						<Link
							style={{ ...styles.link, fontSize: "12px" }}
							href={`https://${SITE_DOMAIN}`}
						>
							{SITE_DOMAIN}
						</Link>
					</Text>
				</Container>
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
