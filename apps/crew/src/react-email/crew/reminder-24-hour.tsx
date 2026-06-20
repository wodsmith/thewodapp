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

export type CrewAssignmentReminder24HourEmailProps =
  CrewAssignmentConfirmationEmailProps

export const CrewAssignmentReminder24HourEmail = ({
  eventName,
  volunteerName,
  shiftName,
  roleLabel,
  startsAtLabel,
  endsAtLabel,
  location,
  confirmUrl,
  scheduleUrl,
}: CrewAssignmentReminder24HourEmailProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={fromLine}>WODsmith Crew</Text>
          <Heading style={heading}>Final reminder: confirm your shift</Heading>
          <Text style={paragraph}>Hi {volunteerName},</Text>
          <Text style={paragraph}>
            Your {eventName} crew shift is within 24 hours and still needs a
            response. Please let the organizer know whether you can make it.
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
              Confirm or request a change
            </Link>
          </Section>

          <Text style={paragraph}>
            You can also review your private schedule{" "}
            <Link href={scheduleUrl} style={textLink}>
              from this link
            </Link>
            .
          </Text>
        </Container>
        <Text style={footer}>No WODsmith account is required to respond.</Text>
      </Body>
    </Html>
  )
}

CrewAssignmentReminder24HourEmail.PreviewProps = {
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
} as CrewAssignmentReminder24HourEmailProps

export default CrewAssignmentReminder24HourEmail
