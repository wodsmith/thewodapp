export type ReceiptOutcome = "accepted" | "rejected" | "failed"

/**
 * Privacy-safe evidence emitted by an application operation.
 *
 * Domain slices extend this envelope with opaque aggregate identifiers. Receipts
 * describe the decision, never score contents, contact details, or credentials.
 */
export interface OperationReceipt<
  TOperation extends string = string,
  TAggregateIds extends {
    readonly [TKey in keyof TAggregateIds]: string | null
  } = Readonly<Record<string, string | null>>,
> {
  readonly operation: TOperation
  readonly aggregateIds: TAggregateIds
  readonly outcome: ReceiptOutcome
  readonly implementationVersion: string
}
