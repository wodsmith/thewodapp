// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  createSeries: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
  reorderSeries: vi.fn(),
  success: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: unknown) => serverFn,
}))

vi.mock("@atlaskit/pragmatic-drag-and-drop/combine", () => ({
  combine: (...cleanups: Array<() => void>) => () => {
    for (const cleanup of cleanups) cleanup()
  },
}))

vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
  draggable: () => () => undefined,
  dropTargetForElements: () => () => undefined,
}))

vi.mock(
  "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview",
  () => ({ pointerOutsideOfPreview: () => ({ x: 0, y: 0 }) }),
)

vi.mock(
  "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview",
  () => ({ setCustomNativeDragPreview: vi.fn() }),
)

vi.mock(
  "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge",
  () => ({
    attachClosestEdge: (data: unknown) => data,
    extractClosestEdge: () => null,
  }),
)

vi.mock(
  "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box",
  () => ({ DropIndicator: () => null }),
)

vi.mock("@/server-fns/registration-questions-fns", () => ({
  QUESTION_TYPES: ["text", "select", "number"],
  createQuestionFn: mocks.create,
  createSeriesQuestionFn: mocks.createSeries,
  updateQuestionFn: mocks.update,
  deleteQuestionFn: mocks.delete,
  reorderQuestionsFn: mocks.reorder,
  reorderSeriesQuestionsFn: mocks.reorderSeries,
}))

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}))

vi.mock("@/components/ui/select", async () => {
  const React = await import("react")
  type SelectContextValue = {
    onValueChange?: (value: string) => void
    options: Array<{ label: ReactNode; value: string }>
    value: string
  }
  const SelectContext = React.createContext<SelectContextValue | null>(null)

  function collectOptions(node: ReactNode) {
    const options: Array<{ label: ReactNode; value: string }> = []
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<{ children?: ReactNode; value?: string }>(child)) {
        return
      }
      if (typeof child.props.value === "string") {
        options.push({ label: child.props.children, value: child.props.value })
      }
      options.push(...collectOptions(child.props.children))
    })
    return options
  }

  function Select({
    children,
    defaultValue = "",
    onValueChange,
  }: {
    children: ReactNode
    defaultValue?: string
    onValueChange?: (value: string) => void
  }) {
    const [value, setValue] = React.useState(defaultValue)
    return (
      <SelectContext.Provider
        value={{
          onValueChange: (nextValue) => {
            setValue(nextValue)
            onValueChange?.(nextValue)
          },
          options: collectOptions(children),
          value,
        }}
      >
        {children}
      </SelectContext.Provider>
    )
  }

  function SelectTrigger(props: ComponentProps<"select">) {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectTrigger requires Select")
    return (
      <select
        {...props}
        value={context.value}
        onChange={(event) => context.onValueChange?.(event.target.value)}
      >
        {context.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return {
    Select,
    SelectContent: ({ children }: { children: ReactNode }) => children,
    SelectItem: () => null,
    SelectTrigger,
    SelectValue: () => null,
  }
})

import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"

type Props = ComponentProps<typeof RegistrationQuestionsEditor>

const existingQuestion: Props["questions"][number] = {
  id: "question_1",
  competitionId: "competition_1",
  groupId: null,
  type: "select",
  label: "Shirt size",
  helpText: "Choose one",
  options: ["Small", "Large"],
  required: false,
  forTeammates: true,
  sortOrder: 0,
  questionTarget: "athlete",
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    entityType: "competition",
    entityId: "competition_1",
    teamId: "team_1",
    questions: [],
    onQuestionsChange: mocks.success,
    overrides: {
      createQuestion: mocks.create,
      updateQuestion: mocks.update,
      deleteQuestion: mocks.delete,
      reorderQuestions: mocks.reorder,
    },
    ...overrides,
  }
}

function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Add Question" }))
}

function chooseSelectType() {
  fireEvent.change(screen.getByRole("combobox", { name: "Question type" }), {
    target: { value: "select" },
  })
}

describe("Crew registration question option field composition", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.create.mockResolvedValue({ question: existingQuestion })
    mocks.update.mockResolvedValue({ question: existingQuestion })
  })

  // @lat: [[ui-library#UI Library#Current boundary#Empty state composition#Direct organizer consumers#Crew registration questions empty state]]
  it("keeps the empty questions action under a section-level heading", () => {
    render(<RegistrationQuestionsEditor {...props()} />)

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "No registration questions yet",
      }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Add Question" }))

    expect(
      screen.getByRole("heading", { name: "Add Registration Question" }),
    ).toBeVisible()
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Registration option field groups#Crew registration option type rendering]]
  it("renders the Options group only for select questions", () => {
    render(<RegistrationQuestionsEditor {...props()} />)
    openCreateDialog()

    expect(screen.queryByRole("group", { name: "Options" })).toBeNull()
    chooseSelectType()

    expect(screen.getByRole("group", { name: "Options" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "New option" })).toBeVisible()
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Registration option field groups#Crew registration option editing]]
  it("adds trimmed options, rejects duplicates, and exposes named remove controls", () => {
    render(<RegistrationQuestionsEditor {...props()} />)
    openCreateDialog()
    chooseSelectType()

    const optionInput = screen.getByRole("textbox", { name: "New option" })
    fireEvent.change(optionInput, { target: { value: "  Small  " } })
    fireEvent.click(screen.getByRole("button", { name: "Add option" }))
    expect(screen.getByText("Small")).toBeVisible()

    fireEvent.change(optionInput, { target: { value: "Small" } })
    fireEvent.click(screen.getByRole("button", { name: "Add option" }))
    expect(mocks.toastError).toHaveBeenCalledWith("Option already exists")
    expect(screen.getAllByText("Small")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Remove option Small" }))
    expect(screen.queryByText("Small")).toBeNull()
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Registration option field groups#Crew registration option validation]]
  it("renders aggregate validation as a semantic Options group error", async () => {
    render(<RegistrationQuestionsEditor {...props()} />)
    openCreateDialog()
    chooseSelectType()
    fireEvent.change(screen.getByRole("textbox", { name: "Question label" }), {
      target: { value: "Shirt size" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent(
      "Select questions must have at least one option",
    )
    expect(screen.getByRole("group", { name: "Options" })).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(mocks.create).not.toHaveBeenCalled()
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Registration option field groups#Crew registration option create payload]]
  it("preserves the canonical select-question create payload", async () => {
    render(<RegistrationQuestionsEditor {...props()} />)
    openCreateDialog()
    chooseSelectType()
    fireEvent.change(screen.getByRole("textbox", { name: "Question label" }), {
      target: { value: "Shirt size" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: "New option" }), {
      target: { value: "Small" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add option" }))
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          competitionId: "competition_1",
          teamId: "team_1",
          type: "select",
          label: "Shirt size",
          helpText: null,
          options: ["Small"],
          required: true,
          forTeammates: false,
          questionTarget: "athlete",
        },
      }),
    )
  })

  // @lat: [[ui-library#UI Library#Current boundary#Field composition#Registration option field groups#Crew registration option update payload]]
  it("preserves existing options and the canonical update payload", async () => {
    render(
      <RegistrationQuestionsEditor
        {...props({ questions: [existingQuestion] })}
      />,
    )
    const item = screen.getByText("Shirt size").closest(".flex.items-start.gap-3")
    const editButton = item?.querySelectorAll("button")[1]
    expect(editButton).not.toBeNull()
    fireEvent.click(editButton as HTMLButtonElement)

    expect(screen.getByRole("group", { name: "Options" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Update" }))

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        data: {
          questionId: "question_1",
          teamId: "team_1",
          type: "select",
          label: "Shirt size",
          helpText: "Choose one",
          options: ["Small", "Large"],
          required: false,
          forTeammates: true,
        },
      }),
    )
  })
})
