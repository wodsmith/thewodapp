import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, expect, it, vi } from "vitest"

type TestOptions = { component: () => ReactNode; validateSearch: (input: Record<string, unknown>) => Record<string, unknown> }
const state = vi.hoisted(() => ({
  options: {} as Record<string, TestOptions>,
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  data: { workouts: [], totalCount: 0, currentPage: 1, pageSize: 50, filterOptions: {tags:[],movements:[],tracks:[]}, teamId:"gym-a", date:"2026-09-06", teams:[{id:"gym-a",name:"Gym A"},{id:"gym-b",name:"Gym B"}] },
}))
vi.mock("@tanstack/react-router",()=>({
  createFileRoute:(path:string)=>(options:TestOptions)=>{
    state.options[path]=options
    return {fullPath:path,useLoaderData:()=>state.data,useSearch:()=>state.search}
  },
  useNavigate:()=>state.navigate,
  Link:({children}:{children:ReactNode})=><a>{children}</a>,
  redirect:vi.fn(),
}))
vi.mock("@/server-fns/training-fns",()=>({getTrainingContextFn:vi.fn()}))
vi.mock("@/server-fns/workout-fns",()=>({getWorkoutFilterOptionsFn:vi.fn(),getWorkoutsFn:vi.fn(),getWorkoutByIdFn:vi.fn(),getWorkoutScheduledInstancesFn:vi.fn()}))
vi.mock("@/server-fns/workout-remix-fns",()=>({getWorkoutRemixInfoFn:vi.fn()}))
vi.mock("@/server-fns/log-fns",()=>({getWorkoutScoresFn:vi.fn()}))
vi.mock("@/lib/posthog",()=>({trackEvent:vi.fn()}))
vi.mock("@/components/workout-remix-info",()=>({WorkoutRemixInfo:()=>null}))
vi.mock("@/components/workout-filters",()=>({WorkoutFilters:()=>null}))
vi.mock("@/components/workout-card",()=>({WorkoutCard:()=>null}))
vi.mock("@/components/pagination",()=>({Pagination:()=>null}))
import "@/routes/_protected/workouts/index"
import "@/routes/_protected/workouts/$workoutId/index"

beforeEach(()=>{state.navigate.mockReset();state.search={}})

// @lat: [[training#Workout Library#Library gym filters reset]]
it("clears gym-specific filters when changing gyms",()=>{
  state.search={teamId:"gym-a",trackId:"track-a",tagIds:"tag-a",movementIds:"move-a",q:"squat",workoutType:"load",page:4}
  const Page=state.options["/_protected/workouts/"]!.component
  render(<Page />)
  fireEvent.change(screen.getByLabelText("Gym or coaching group"),{target:{value:"gym-b"}})
  const next=state.navigate.mock.calls[0]![0].search(state.search)
  expect(next).toMatchObject({teamId:"gym-b",page:1,q:"squat",workoutType:"load"})
  expect(next.trackId).toBeUndefined()
  expect(next.tagIds).toBeUndefined()
  expect(next.movementIds).toBeUndefined()
})

// @lat: [[training#Workout Library#Library search submits once]]
it("preserves typed search without navigating until the form submits",()=>{
  const Page=state.options["/_protected/workouts/"]!.component
  render(<Page />)
  const input=screen.getByRole("textbox",{name:"Search workout library"})
  fireEvent.change(input,{target:{value:"F"}})
  fireEvent.change(input,{target:{value:"Fran"}})
  expect(input).toHaveValue("Fran")
  expect(state.navigate).not.toHaveBeenCalled()
  fireEvent.submit(screen.getByRole("form",{name:"Workout library search"}))
  expect(state.navigate).toHaveBeenCalledOnce()
  expect(state.navigate.mock.calls[0]![0].search({page:4})).toEqual({page:1,q:"Fran"})
})

// @lat: [[training#Workout Library#Library dates match training dates]]
it("drops invalid calendar dates on both library routes and preserves valid leap days",()=>{
  for(const route of Object.values(state.options)) {
    for(const date of ["2026-02-30","2026-13-01","1999-12-31","2101-01-01","bad"]) {
      expect(route.validateSearch({date}).date).toBeUndefined()
    }
    expect(route.validateSearch({date:"2028-02-29"}).date).toBe("2028-02-29")
  }
})
