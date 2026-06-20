// @lat: [[crew#Confirmation Emails And Reminders]]
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
import {
  AssignmentDetails,
  button,
  buttonContainer,
  container,
  footer,
  fromLine,
  heading,
  main,
  paragraph,
  textLink,
  type CrewAssignmentConfirmationEmailProps,
} from "./assignment-confirmation"

export type CrewAssignmentReminderEmailProps =
  CrewAssignmentConfirmationEmailProps

export const CrewAssignmentReminder48HourEmail = ({
  eventName,
  volunteerName,
  shiftName,
  roleLabel,
  startsAtLabel,
  endsAtLabel,
  location,
  confirmUrl,
  scheduleUrl,
}: CrewAssignmentReminderEmailProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={fromLine}>WODsmith Crew</Text>
          <Heading style={heading}>Reminder: confirm your assignment</Heading>
          <Text style={paragraph}>Hi {volunteerName},</Text>
          <Text style={paragraph}>
            {eventName} is coming up, and we still need your response for this
            assignment. Please confirm, decline, or request a change.
          </Text>

          <AssignmentDetails
            shiftName={shiftName}
            roleLabel={roleLabel}
            startsAtLabel={startsAtLabel}
            endsAtLabel={endsAtLabel}
            location={location}
          />

          <Section style={buttonContainer}>
            <Link style={button} href={confirmUrl}>
              Respond to assignment
            </Link>
          </Section>

          <Text style={paragraph}>
            Your private schedule link is{" "}
            <Link href={scheduleUrl} style={textLink}>
              available here
            </Link>
            .
          </Text>
        </Container>
        <Text style={footer}>No WODsmith account is required to respond.</Text>
      </Body>
    </Html>
  )
}

CrewAssignmentReminder48HourEmail.PreviewProps = {
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
} as CrewAssignmentReminderEmailProps

export default CrewAssignmentReminder48HourEmail
