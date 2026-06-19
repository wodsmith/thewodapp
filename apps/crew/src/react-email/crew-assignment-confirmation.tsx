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

export interface CrewAssignmentConfirmationEmailProps {
  eventName: string
  volunteerName: string
  shiftName: string
  roleLabel: string
  startsAtLabel: string
  endsAtLabel: string
  location?: string | null
  confirmUrl: string
  scheduleUrl: string
}

export const CrewAssignmentConfirmationEmail = ({
  eventName,
  volunteerName,
  shiftName,
  roleLabel,
  startsAtLabel,
  endsAtLabel,
  location,
  confirmUrl,
  scheduleUrl,
}: CrewAssignmentConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={fromLine}>WODsmith Crew</Text>
          <Heading style={heading}>Confirm your assignment</Heading>
          <Text style={paragraph}>Hi {volunteerName},</Text>
          <Text style={paragraph}>
            You are assigned to help with {eventName}. Please confirm that this
            shift still works for you, or request a change if something needs
            attention.
          </Text>

          <Section style={detailSection}>
            <Text style={detailRow}>
              <strong>Shift:</strong> {shiftName}
            </Text>
            <Text style={detailRow}>
              <strong>Role:</strong> {roleLabel}
            </Text>
            <Text style={detailRow}>
              <strong>Time:</strong> {startsAtLabel} to {endsAtLabel}
            </Text>
            {location ? (
              <Text style={detailRow}>
                <strong>Location:</strong> {location}
              </Text>
            ) : null}
          </Section>

          <Section style={buttonContainer}>
            <Link style={button} href={confirmUrl}>
              Review and respond
            </Link>
          </Section>

          <Text style={paragraph}>
            You can also view your schedule at{" "}
            <Link href={scheduleUrl} style={textLink}>
              this private schedule link
            </Link>
            .
          </Text>
        </Container>
        <Text style={footer}>
          This assignment link is private to you. No WODsmith account is
          required to respond.
        </Text>
      </Body>
    </Html>
  )
}

CrewAssignmentConfirmationEmail.PreviewProps = {
  eventName: "Mountain West Throwdown",
  volunteerName: "Ada",
  shiftName: "Lane judging block 1",
  roleLabel: "Judge",
  startsAtLabel: "Sat, Jun 27 9:00 AM",
  endsAtLabel: "11:00 AM",
  location: "Floor 1",
  confirmUrl:
    "https://crew.wodsmith.com/e/mountain-west-throwdown/confirm/example",
  scheduleUrl:
    "https://crew.wodsmith.com/e/mountain-west-throwdown/schedule/example",
} as CrewAssignmentConfirmationEmailProps

export default CrewAssignmentConfirmationEmail

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
  margin: "20px auto",
  maxWidth: "600px",
  padding: "40px",
}

const fromLine = {
  color: "#64748b",
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

const paragraph = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "24px",
  marginBottom: "14px",
}

const detailSection = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "5px",
  marginBottom: "16px",
  padding: "18px",
}

const detailRow = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 8px 0",
}

const buttonContainer = {
  margin: "28px 0",
  textAlign: "center" as const,
}

const button = {
  backgroundColor: "#0f766e",
  borderRadius: "5px",
  color: "#fff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "bold",
  margin: "0 auto",
  padding: "13px 32px",
  textAlign: "center" as const,
  textDecoration: "none",
}

const textLink = {
  color: "#0f766e",
  textDecoration: "underline",
}

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "20px 0",
  textAlign: "center" as const,
}
