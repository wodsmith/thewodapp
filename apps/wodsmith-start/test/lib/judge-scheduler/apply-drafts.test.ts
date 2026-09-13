import { describe, expect, it, vi } from "vitest"
import { applyJudgeDrafts } from "@/lib/judge-scheduler/apply-drafts"
describe("applyJudgeDrafts", () => {
  // @lat: [[organizer-recovery#Draft acknowledgement recovery]]
  it("refreshes committed drafts after acknowledgement rejection and supports reconciliation retry", async () => {
    const save = vi.fn().mockResolvedValueOnce({ appliedCount: 1 }).mockResolvedValueOnce({ appliedCount: 0 })
    const acknowledge = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined)
    const refresh = vi.fn().mockResolvedValue(undefined)
    expect(await applyJudgeDrafts({ save, acknowledge, refresh })).toEqual({ appliedCount: 1, acknowledged: false, refreshed: true })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(await applyJudgeDrafts({ save, acknowledge, refresh })).toEqual({ appliedCount: 0, acknowledged: true, refreshed: true })
  })
  it("does not acknowledge a failed write", async () => {
    const acknowledge = vi.fn(), refresh = vi.fn()
    await expect(applyJudgeDrafts({ save: vi.fn().mockRejectedValue(new Error("write failed")), acknowledge, refresh })).rejects.toThrow("write failed")
    expect(acknowledge).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
  it("reports refresh failure separately after successful persistence and acknowledgement", async () => {
    expect(await applyJudgeDrafts({ save: async () => ({ appliedCount: 1 }), acknowledge: async () => {}, refresh: async () => { throw new Error("offline") } })).toEqual({ appliedCount: 1, acknowledged: true, refreshed: false })
  })
})
