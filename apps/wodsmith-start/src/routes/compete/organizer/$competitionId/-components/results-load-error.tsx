import { AlertTriangle } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface ResultsLoadErrorProps {
  onRetry: () => void
}

export function ResultsLoadError({ onRetry }: ResultsLoadErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <div>
        <h3 className="font-medium leading-none tracking-tight">
          Unable to load results
        </h3>
        <p className="mt-2 text-sm">
          Unable to load score entry data. Please try again.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    </Alert>
  )
}
