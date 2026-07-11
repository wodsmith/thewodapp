import { ClipboardCheck, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface CheckInInstructionsProps {
  competitionSlug: string
}

export function CheckInInstructions({
  competitionSlug,
}: CheckInInstructionsProps) {
  const titleId = "check-in-instructions-title"

  return (
    <section aria-labelledby={titleId}>
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>
            <h2 id={titleId} className="text-xl">
              Day-of check-in
            </h2>
          </CardTitle>
          <CardDescription>
            Run check-in from a shared device at the door. Search for an athlete
            and tap check in to mark their whole team as arrived. Athletes can
            sign any missing waivers right on the device. Volunteers on this
            competition can also run the kiosk from their volunteer dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a
              href={`/compete/${competitionSlug}/check-in`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Open check-in kiosk
            </a>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
