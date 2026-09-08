import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { PersonalTrainingDay } from "@/lib/training/personal-types"
const api = vi.hoisted(() => ({day: vi.fn(), save: vi.fn()}))
vi.mock("@/server-fns/training-personal-fns", () => ({getPersonalTrainingDayFn: api.day, savePersonalTrainingSessionFn: api.save}))
import { SessionWorkoutActions } from "@/components/training/session-workout-actions"
const day: PersonalTrainingDay = {defaultTrackId: "a", selectedTrackId: "b", sourceSession: null, personalSession: null, items: [], results: [], libraryResults: []}
const workout = {name: "Workout B", description: "Row", scheme: "time"}
beforeEach(() => {api.day.mockResolvedValue(day); api.save.mockImplementation(async ({data}) => ({id:"session",teamId:"gym",trainingDate:data.trainingDate,revision:data.expectedRevision+1,items:data.mode === "undo" ? [] : data.items.map((item: object) => ({...item,workout}))}))})
afterEach(cleanup)
function Host() {
 const [current, setCurrent] = useState(day)
 return <SessionWorkoutActions teamId="gym" date="2026-09-07" trackId="b" workoutId="workout-b" day={current} onChanged={setCurrent} onOpenSession={() => {}} />
}
// @lat: [[training-personal#Verification#Session action receipts]]
it("adds in place and undoes the inserted identity after its parent receives the new session", async () => {
 render(<Host />)
 fireEvent.click(screen.getByRole("button", {name:"Add to My session"}))
 await screen.findByText("Added to My session · 2026-09-07")
 const inserted = api.save.mock.calls[0][0].data.items[0].id
 fireEvent.click(screen.getByRole("button", {name:"Undo"}))
 await waitFor(() => expect(api.save.mock.calls[1][0].data).toMatchObject({expectedRevision:1,mode:"undo",items:[{id:inserted}]}))
 expect(await screen.findByRole("button", {name:"Add to My session"})).toBeEnabled()
})
// @lat: [[training-personal#Verification#Session retries preserve intent]]
it("retries a lost response with the same identity and never posts while opening direct log", async () => {
 api.save.mockRejectedValueOnce(new Error("Response lost. Retry."))
 render(<Host />)
 expect(screen.getByRole("link",{name:"Log score"})).toHaveAttribute("href",expect.stringContaining("sourceDate=2026-09-07"))
 expect(api.save).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole("button",{name:"Add to My session"}))
 await screen.findByRole("alert")
 fireEvent.click(screen.getByRole("button",{name:"Add to My session"}))
 await screen.findByRole("button",{name:"Undo"})
 expect(api.save.mock.calls[1][0]).toEqual(api.save.mock.calls[0][0])
})
// @lat: [[training-personal#Verification#Direct occurrence display]]
it("shows the actual score only on its exact source date and track occurrence", () => {
 const recorded = {...day,libraryResults:[{itemId:"attempt",scoreId:"score-b",displayScore:"1:23",workoutId:"workout-b",occurrence:{trackId:"b",sourceDate:"2026-09-06"}}]}
 const view = render(<SessionWorkoutActions teamId="gym" date="2026-09-07" trackId="b" workoutId="workout-b" day={recorded} onChanged={() => {}} />)
 expect(screen.getByRole("link",{name:"Log score"})).toBeInTheDocument()
 view.rerender(<SessionWorkoutActions teamId="gym" date="2026-09-06" trackId="b" workoutId="workout-b" day={recorded} onChanged={() => {}} />)
 expect(screen.getByRole("link",{name:"Edit score · 1:23"})).toHaveAttribute("href",expect.stringContaining("/log/score-b/edit"))
})
// @lat: [[training-personal#Verification#Late additions preserve context]]
it("ignores a late addition after navigating to another training date", async () => {
 let resolve!: (value: unknown) => void
 api.save.mockReturnValue(new Promise(done => {resolve = done}))
 const changed = vi.fn()
 const view = render(<SessionWorkoutActions teamId="gym" date="2026-09-07" workoutId="workout-b" day={day} onChanged={changed} />)
 fireEvent.click(screen.getByRole("button",{name:"Add to My session"}))
 view.rerender(<SessionWorkoutActions teamId="gym" date="2026-09-08" workoutId="workout-b" day={day} onChanged={changed} />)
 await act(async () => resolve({id:"old",revision:1,items:[]}))
 expect(changed).not.toHaveBeenCalled()
 expect(screen.queryByRole("button",{name:"Undo"})).not.toBeInTheDocument()
 expect(screen.getByRole("button",{name:"Add to My session"})).toBeEnabled()
})

// @lat: [[training-personal#Verification#Existing additions have no false undo]]
it("does not offer an undo receipt when another tab already added the same occurrence", async () => {
 api.save.mockResolvedValue({id:"session",teamId:"gym",trainingDate:"2026-09-07",revision:2,items:[{id:"other-tab",kind:"library",workoutId:"workout-b",workout,occurrence:{trackId:"b",sourceDate:"2026-09-07"}}]})
 render(<Host />)
 fireEvent.click(screen.getByRole("button",{name:"Add to My session"}))
 await screen.findByRole("link",{name:"In My session"})
 expect(screen.queryByRole("button",{name:"Undo"})).not.toBeInTheDocument()
 expect(screen.queryByText(/Added to My session/)).not.toBeInTheDocument()
})

// @lat: [[training-personal#Verification#Destination loading clears stale revisions]]
it("disables Add while the newly selected destination is still loading", async () => {
 const changed=vi.fn()
 const old={...day,personalSession:{id:"old",teamId:"gym",trainingDate:"2026-09-07",revision:9,items:[]}}
 const view=render(<SessionWorkoutActions teamId="gym" date="2026-09-07" workoutId="workout-b" day={old} onChanged={changed}/>)
 view.rerender(<SessionWorkoutActions teamId="gym" date="2026-09-08" workoutId="workout-b" day={undefined} onChanged={changed}/>)
 expect(screen.getByRole("button",{name:"Add to My session"})).toBeDisabled()
 expect(api.save).not.toHaveBeenCalled()
 view.rerender(<SessionWorkoutActions teamId="gym" date="2026-09-08" workoutId="workout-b" day={day} onChanged={changed}/>)
 fireEvent.click(screen.getByRole("button",{name:"Add to My session"}))
 await waitFor(()=>expect(api.save).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({trainingDate:"2026-09-08",expectedRevision:0})})))
})
