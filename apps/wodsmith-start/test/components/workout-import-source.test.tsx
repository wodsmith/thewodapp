import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { validateImportImage, WorkoutImportSource } from "@/components/workout-import/source-input"

afterEach(() => vi.unstubAllGlobals())

describe("workout import source", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Bounded image source]]
  it("accepts only a nonempty PNG, JPEG, or WebP within the image limit", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) expect(validateImportImage(new File(["image"], "source", { type }))).toBeNull()
    expect(validateImportImage(new File(["<svg/>"], "source.svg", { type: "image/svg+xml" }))).toMatch(/PNG, JPEG, or WebP/)
    expect(validateImportImage(new File([], "empty.png", { type: "image/png" }))).toMatch(/empty/)
    expect(validateImportImage(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }))).toMatch(/larger than 10 MiB/)
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Keyboard image inspection]]
  it("provides a labeled picker and preview, and releases the local preview URL", () => {
    const revoke = vi.fn()
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:test-image"); static revokeObjectURL = revoke })
    const onFileChange = vi.fn()
    const file = new File(["image"], "workout.png", { type: "image/png" })
    const { unmount } = render(<WorkoutImportSource text="" onTextChange={vi.fn()} file={file} onFileChange={onFileChange} disabled={false} />)
    expect(screen.getByLabelText("Workout screenshot")).toHaveAttribute("type", "file")
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:test-image")
    expect(screen.getByRole("link", { name: "View full image" })).toHaveAttribute("href", "blob:test-image")
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }))
    expect(onFileChange).toHaveBeenCalledWith(null)
    unmount()
    expect(revoke).toHaveBeenCalledWith("blob:test-image")
  })
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Invalid image replacement]]
it("clears the active image and preview when its replacement is invalid", () => {
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:old"); static revokeObjectURL = vi.fn() })
  const changed = vi.fn()
  function Source() {
    const [file, setFile] = useState<File | null>(new File(["image"], "old.png", { type: "image/png" }))
    return <WorkoutImportSource text="" onTextChange={vi.fn()} file={file} onFileChange={(next) => { changed(next); setFile(next) }} disabled={false} />
  }
  render(<Source />)
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:old")
  fireEvent.change(screen.getByLabelText("Workout screenshot"), { target: { files: [new File(["text"], "invalid.txt", { type: "text/plain" })] } })
  expect(changed).toHaveBeenCalledWith(null)
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent(/PNG, JPEG, or WebP/)
})
