import type { OperationReceipt } from "./receipt"

export interface ApplicationClock {
  now(): Date
}

export interface ApplicationLogger {
  record(receipt: OperationReceipt): void | Promise<void>
}

/**
 * Runtime-neutral capabilities shared by application composition roots.
 * Operation-specific stores and providers belong beside the operation that
 * consumes them instead of accumulating in this base interface.
 */
export interface ApplicationServices {
  readonly clock: ApplicationClock
  readonly logger: ApplicationLogger
}
