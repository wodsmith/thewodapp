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

interface CompetitionTeamMemberAddedEmailProps {
  rosterLink: string
  recipientEmail: string
  teamName: string
  competitionName: string
  divisionName: string
  inviterName: string
}

export const CompetitionTeamMemberAddedEmail = ({
  rosterLink,
  recipientEmail,
  teamName,
  competitionName,
  divisionName,
  inviterName,
}: CompetitionTeamMemberAddedEmailProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={preheader}>
            You&apos;ve been added to {teamName} for {competitionName}
          </Heading>
          <Text style={paragraph}>Hello,</Text>
          <Text style={paragraph}>
            {inviterName} added you to the team &quot;{teamName}&quot; (
            {divisionName}) for {competitionName} on {SITE_DOMAIN}.
          </Text>
          <Text style={paragraph}>
            Before competition day you still need to finish your registration:
          </Text>
          <Text style={listItem}>• Answer any registration questions</Text>
          <Text style={listItem}>• Sign the required waivers</Text>
          <Section style={buttonContainer}>
            <Link style={button} href={rosterLink}>
              Complete your registration
            </Link>
          </Section>
          <Text style={paragraph}>
            This email was sent to {recipientEmail}. If the button above
            doesn&apos;t work, copy and paste this URL into your browser:
          </Text>
          <Text style={link}>{rosterLink}</Text>
          <Text style={paragraph}>
            If you didn&apos;t expect to be added to this team, contact your
            captain or reply to this email.
          </Text>
        </Container>
        <Text style={footer}>
          This is an automated message from {SITE_DOMAIN}.
        </Text>
      </Body>
    </Html>
  )
}

CompetitionTeamMemberAddedEmail.PreviewProps = {
  rosterLink: "https://example.com/compete/test-comp/teams/reg-123",
  recipientEmail: "athlete@example.com",
  teamName: "Alpha Squad",
  competitionName: "Test Competition",
  divisionName: "Team of 3",
  inviterName: "Jane Doe",
} as CompetitionTeamMemberAddedEmailProps

export default CompetitionTeamMemberAddedEmail

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

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
  marginBottom: "16px",
}

const listItem = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
  marginBottom: "8px",
  paddingLeft: "12px",
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
