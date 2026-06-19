export type ProfileCompletionInput = {
  firstName: string | null
  lastName: string | null
  avatar: string | null
  gender: string | null
  dateOfBirth: Date | null
  heightCm: number | null
  weightKg: number | null
}

export type ProfileCompletionItem = {
  id: "name" | "avatar" | "dob" | "physical"
  label: string
  done: boolean
  target: "/settings/profile" | "/settings/athlete"
}

export type ProfileCompletion = {
  completed: number
  total: number
  percent: number
  items: ProfileCompletionItem[]
}

export function calculateProfileCompletion(
  input: ProfileCompletionInput,
): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    {
      id: "name",
      label: "Add your name",
      done: !!(input.firstName?.trim() && input.lastName?.trim()),
      target: "/settings/profile",
    },
    {
      id: "avatar",
      label: "Upload an avatar",
      done: !!input.avatar?.trim(),
      target: "/settings/profile",
    },
    {
      id: "dob",
      label: "Date of birth & gender",
      done: !!input.dateOfBirth && !!input.gender,
      target: "/settings/athlete",
    },
    {
      id: "physical",
      label: "Height & weight",
      done: !!(input.heightCm && input.weightKg),
      target: "/settings/athlete",
    },
  ]
  const completed = items.filter((i) => i.done).length
  const total = items.length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { completed, total, percent, items }
}
