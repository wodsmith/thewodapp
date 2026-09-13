import { expect, it, vi } from "vitest"
const deliver = vi.hoisted(() => vi.fn())
vi.mock("@/server/gameday-push", () => ({ deliverGameDayPush: deliver }))
vi.mock("@/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/env", () => ({ getResendApiKey: () => undefined, getEmailFrom: () => "fixture@example.com", getEmailFromName: () => "Fixture" }))
import { handleBroadcastEmailQueue } from "@/server/broadcast-queue-consumer"

// @lat: [[gameday-push#Tests#Queue dispatch isolation]]
it("dispatches push by kind and preserves the existing email consumer", async () => {
  const push = { body: { kind: "gameday-push", deliveryId: "delivery" }, ack: vi.fn(), retry: vi.fn() }
  const email = { body: { broadcastId: "broadcast", batch: [], subject: "Fixture", bodyHtml: "" }, ack: vi.fn(), retry: vi.fn() }
  await handleBroadcastEmailQueue({ messages: [push, email] } as unknown as Parameters<typeof handleBroadcastEmailQueue>[0])
  expect(deliver).toHaveBeenCalledExactlyOnceWith("delivery")
  expect(push.ack).toHaveBeenCalledOnce()
  expect(email.ack).toHaveBeenCalledOnce()
  expect(push.retry).not.toHaveBeenCalled()
})
it("retries a queue delivery if the durable consumer could not persist its result", async () => {
  deliver.mockRejectedValueOnce(new Error("Database unavailable"))
  const message = { body: { kind: "gameday-push", deliveryId: "delivery" }, ack: vi.fn(), retry: vi.fn() }
  await handleBroadcastEmailQueue({ messages: [message] } as unknown as Parameters<typeof handleBroadcastEmailQueue>[0])
  expect(message.retry).toHaveBeenCalledOnce()
  expect(message.ack).not.toHaveBeenCalled()
})
