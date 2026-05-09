import { describe, expect, it } from "vitest"
import { calculateProfileCompletion } from "@/lib/settings/profile-completion"

describe("calculateProfileCompletion", () => {
  it("returns 0 when no fields are filled", () => {
    const result = calculateProfileCompletion({
      firstName: "",
      lastName: "",
      avatar: null,
      gender: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
    })
    expect(result.completed).toBe(0)
    expect(result.total).toBe(4)
    expect(result.percent).toBe(0)
  })

  it("counts name, avatar, dob, and physical stats", () => {
    const result = calculateProfileCompletion({
      firstName: "Ian",
      lastName: "Jones",
      avatar: "https://example.com/a.jpg",
      gender: "male",
      dateOfBirth: new Date("1993-11-24"),
      heightCm: 185,
      weightKg: 93,
    })
    expect(result.completed).toBe(4)
    expect(result.total).toBe(4)
    expect(result.percent).toBe(100)
  })

  it("treats partial physical stats (height only) as incomplete", () => {
    const result = calculateProfileCompletion({
      firstName: "Ian",
      lastName: "Jones",
      avatar: null,
      gender: null,
      dateOfBirth: null,
      heightCm: 185,
      weightKg: null,
    })
    expect(result.completed).toBe(1)
    expect(result.percent).toBe(25)
  })

  it("returns deep-link target for each unchecked item", () => {
    const result = calculateProfileCompletion({
      firstName: "",
      lastName: "",
      avatar: null,
      gender: null,
      dateOfBirth: null,
      heightCm: null,
      weightKg: null,
    })
    const labels = result.items.map((i) => i.id)
    expect(labels).toEqual(["name", "avatar", "dob", "physical"])
    const nameItem = result.items.find((i) => i.id === "name")
    expect(nameItem?.target).toBe("/settings/profile")
    const dobItem = result.items.find((i) => i.id === "dob")
    expect(dobItem?.target).toBe("/settings/athlete")
    const physItem = result.items.find((i) => i.id === "physical")
    expect(physItem?.target).toBe("/settings/athlete")
  })
})
