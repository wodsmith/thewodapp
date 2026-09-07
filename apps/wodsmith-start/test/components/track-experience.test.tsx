import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { it, expect, vi } from "vitest"
import {
  TrackDetailView,
  type TrackDetailData,
} from "@/components/track-detail-view"
import { TrackFollowActions } from "@/components/track-follow-actions"
import { followTrackFn, addTrackToGymFn } from "@/server-fns/track-follow-fns"
import { CrossFitTrackDays } from "@/components/crossfit-track-days"
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: React.ReactNode
    params: { workoutId: string }
  }) => <a href={`/workouts/${params.workoutId}`}>{children}</a>,
}))
vi.mock("@/server-fns/track-follow-fns", () => ({
  followTrackFn: vi.fn(),
  addTrackToGymFn: vi.fn(),
}))
// @lat: [[training#Provider Verification#Reader and following actions]]
it("separates personal following and gym access and keeps missing dates explicit", () => {
  const state = {
    personalTeamId: "mine",
    following: true,
    trainingAvailable: true,
    gyms: [
      {
        id: "gym",
        name: "A long gym name with a regional training group",
        added: false,
      },
    ],
  }
  const { rerender } = render(
    <TrackFollowActions
      trackId="track"
      date="2026-09-04"
      state={state}
      onChanged={() => {}}
    />,
  )
  expect(
    screen.getByRole("link", { name: "View in Training" }),
  ).toHaveAttribute(
    "href",
    "/training?teamId=mine&trackId=track&date=2026-09-04",
  )
  expect(screen.queryByText("For your gym")).not.toBeInTheDocument()
  rerender(<CrossFitTrackDays days={[]} selectedDate="2026-09-04" />)
  expect(
    screen.getByText("No programming published for this date."),
  ).toBeInTheDocument()
  expect(screen.queryByText("Rest day")).not.toBeInTheDocument()
})
it("previews all score components in their source order", () => {
  const add = vi.fn()
  render(
    <CrossFitTrackDays
      selectedDate="2026-09-04"
      days={[
        {
          id: "import",
          date: "2026-09-04",
          url: "https://www.crossfit.com/260904",
          markdown: "For time\n\n**Scaling**\nHidden scaling",
          kind: "workout",
          workouts: [
            {
              workoutId: "time",
              name: "**Long timed component**",
              scheme: "time-with-cap",
              timeCap: 180,
            },
            {
              workoutId: "load",
              name: "Lift",
              scheme: "load",
              roundsToScore: 3,
              scoreType: "max",
            },
          ],
        },
      ]}
      onAdd={add}
    />,
  )
  expect(
    screen.getByRole("heading", { name: "Long timed component" }),
  ).toBeInTheDocument()
  expect(screen.queryByText("Hidden scaling")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Add all to my day" }))
  expect(add).toHaveBeenCalledWith(["time", "load"])
})

// @lat: [[crossfit-import#CrossFit Daily Import#Tests#Reader admin boundary]]
it("keeps admin controls outside the ordinary reader and legacy library collapsed", () => {
  const data = {
    track: {
      id: "ptrk_crossfit_dotcom",
      name: "CrossFit.com",
      description: "Daily programming",
    },
    date: "2026-09-06",
    days: [],
    selected: [
      {
        id: "rest",
        date: "2026-09-06",
        kind: "rest",
        url: "https://www.crossfit.com/260906",
        markdown: "Rest",
        workouts: [],
      },
    ],
    state: {
      personalTeamId: "mine",
      following: false,
      trainingAvailable: true,
      gyms: [],
    },
    workouts: [
      {
        id: "old",
        trackOrder: 5,
        workout: {
          id: "old",
          name: "**Chipper**",
          description: "Old prescription",
        },
      },
    ],
    canManageImports: false,
  } as unknown as TrackDetailData
  const { rerender } = render(
    <TrackDetailView
      data={data}
      onChanged={() => {}}
      onDateChange={() => {}}
    />,
  )
  expect(
    screen.queryByRole("region", { name: "Admin" }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText("CrossFit workout date")).not.toBeInTheDocument()
  expect(
    screen.getByText("Workout library").closest("details"),
  ).not.toHaveAttribute("open")
  expect(
    screen.getByRole("link", { name: "Chipper", hidden: true }),
  ).toHaveAttribute("href", "/workouts/old")
  rerender(
    <TrackDetailView
      data={{ ...data, canManageImports: true }}
      onChanged={() => {}}
      onDateChange={() => {}}
    />,
  )
  expect(screen.getByRole("region", { name: "Admin" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Manage imports" })).toHaveAttribute(
    "href",
    "/admin/programming/ptrk_crossfit_dotcom",
  )
  expect(
    screen.queryByRole("button", { name: "Preview import" }),
  ).not.toBeInTheDocument()
})

// @lat: [[training#Provider Verification#Follow feedback tracks the current request]]
it.each([false, true])(
  "clears earlier success when the next %s gym action fails",
  async (gymOnly) => {
    const state = {
      personalTeamId: "mine",
      following: false,
      trainingAvailable: true,
      gyms: [{ id: "gym", name: "Test gym", added: false }],
    }
    const mutation = gymOnly ? addTrackToGymFn : followTrackFn
    vi.mocked(mutation).mockResolvedValueOnce({
      teamId: gymOnly ? "gym" : "mine",
    })
    render(
      <TrackFollowActions
        trackId="track"
        date="2026-09-04"
        state={state}
        onChanged={() => {}}
        gymOnly={gymOnly}
      />,
    )
    if (gymOnly) {
      const disclosure = screen.getByText("For your gym").closest("details")!
      disclosure.open = true
      fireEvent.change(screen.getByLabelText("Gym library"), {
        target: { value: "gym" },
      })
    }
    const actionName = gymOnly ? "Add to gym library" : "Follow track"
    fireEvent.click(screen.getByRole("button", { name: actionName }))
    const success = gymOnly ? "Added to Test gym" : "Following in My training"
    expect(await screen.findByText(success)).toBeInTheDocument()
    let fail!: (reason: Error) => void
    vi.mocked(mutation).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        }),
    )
    fireEvent.click(screen.getByRole("button", { name: actionName }))
    expect(screen.queryByText(success)).not.toBeInTheDocument()
    fail(new Error("Could not save this change"))
    await screen.findByText("Could not save this change")
    expect(screen.queryByText(success)).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole("button", { name: actionName })).toBeEnabled(),
    )
  },
)
