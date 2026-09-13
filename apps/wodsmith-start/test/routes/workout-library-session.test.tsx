import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const mock=vi.hoisted(()=>({data:{} as Record<string,unknown>,day:vi.fn(),save:vi.fn(),navigate:vi.fn()}))
vi.mock("@tanstack/react-router",()=>({createFileRoute:()=> (options:unknown)=>({options,useLoaderData:()=>mock.data,useSearch:()=>({}),fullPath:"/workouts"}),redirect:vi.fn(),useNavigate:()=>mock.navigate,Link:({children}:{children:ReactNode})=><a href="/workouts">{children}</a>}))
vi.mock("@/server-fns/training-personal-fns",()=>({getPersonalTrainingDayFn:mock.day,savePersonalTrainingSessionFn:mock.save}))
vi.mock("@/server-fns/training-fns",()=>({getTrainingContextFn:vi.fn()}))
vi.mock("@/server-fns/workout-fns",()=>({getWorkoutsFn:vi.fn(),getWorkoutFilterOptionsFn:vi.fn()}))
vi.mock("@/components/workout-import/workout-import-entry",()=>({WorkoutImportEntry:()=>null}))
vi.mock("@/components/workout-filters",()=>({WorkoutFilters:()=>null}))
vi.mock("@/components/workout-card",()=>({WorkoutCard:()=>null}))
vi.mock("@/components/pagination",()=>({Pagination:()=>null}))
import {Route} from "@/routes/_protected/workouts/index"
const empty={defaultTrackId:null,selectedTrackId:null,sourceSession:null,personalSession:null,items:[],results:[],libraryResults:[]}
beforeEach(()=>{
 mock.data={workouts:[{id:"a",name:"A",scheme:"reps",description:"Work"},{id:"b",name:"B",scheme:"reps",description:"Work"}],totalCount:2,currentPage:1,pageSize:50,filterOptions:{},teamId:"gym",date:"2026-09-07",teams:[]}
 mock.day.mockResolvedValue(empty)
})
afterEach(cleanup)
// @lat: [[session-review-tests#Library retry does not retain an old destination]]
it("clears a previous destination after Retry and keeps Add disabled until the new day loads",async()=>{
 mock.day.mockRejectedValueOnce(new Error("offline"))
 const Page=Route.options.component as ComponentType
 const view=render(<Page />)
 fireEvent.click(await screen.findByRole("button",{name:"Retry My session"}))
 await waitFor(()=>expect(screen.getAllByRole("button",{name:"Add to My session"})[0]).toBeEnabled())
 mock.day.mockReturnValueOnce(new Promise(()=>{}))
 mock.data={...mock.data,date:"2026-09-08"}
 view.rerender(<Page />)
 expect(screen.getAllByRole("button",{name:"Add to My session"})[0]).toBeDisabled()
})
// @lat: [[session-review-tests#Library row receipts survive parent updates]]
it("keeps two rapid addition receipts across parent updates and preserves both items",async()=>{
 let firstResolve!:(value:unknown)=>void
 const firstPromise=new Promise(done=>{firstResolve=done})
 let firstItem:Record<string,unknown>
 mock.save.mockImplementationOnce(({data})=>{firstItem=data.items[0];return firstPromise})
 mock.save.mockRejectedValueOnce(new Error("CONFLICT: Revision changed"))
 mock.day.mockImplementation(async()=>firstItem ? {...empty,personalSession:{id:"session",teamId:"gym",trainingDate:"2026-09-07",revision:1,items:[{...firstItem,workout:{name:"A"},occurrence:{}}]}} : empty)
 mock.save.mockImplementation(async({data})=>({id:"session",teamId:"gym",trainingDate:data.trainingDate,revision:2,items:[{...firstItem,workout:{name:"A"},occurrence:{}},...data.items.map((item:object)=>({...item,workout:{name:"B"},occurrence:{}}))]}))
 const Page=Route.options.component as ComponentType
 render(<Page />)
 const rows=screen.getAllByRole("listitem")
 await waitFor(()=>expect(within(rows[0]).getByRole("button",{name:"Add to My session"})).toBeEnabled())
 fireEvent.click(within(rows[0]).getByRole("button",{name:"Add to My session"}))
 fireEvent.click(within(rows[1]).getByRole("button",{name:"Add to My session"}))
 await within(rows[1]).findByRole("button",{name:"Undo"})
 await act(async()=>firstResolve({id:"session",teamId:"gym",trainingDate:"2026-09-07",revision:1,items:[{...firstItem,workout:{name:"A"},occurrence:{}}]}))
 expect(within(rows[0]).getByRole("button",{name:"Undo"})).toBeVisible()
 expect(within(rows[1]).getByRole("button",{name:"Undo"})).toBeVisible()
 expect(screen.getAllByRole("link",{name:"In My session"})).toHaveLength(2)
})
