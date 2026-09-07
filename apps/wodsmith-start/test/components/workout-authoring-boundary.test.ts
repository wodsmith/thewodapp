import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const sharedFieldConsumers = [
  "src/components/workout-form.tsx",
  "src/components/events/create-event-dialog.tsx",
  "src/components/events/event-details-form.tsx",
  "src/components/training/training-workout-dialog.tsx",
  "src/components/training/personal-workout-definition.tsx",
]

const consumers = [
  { path: "src/components/training/athlete-personal-session.tsx", module: "/personal-workout-definition", component: "PersonalWorkoutDefinition" },
  ...sharedFieldConsumers.map((path) => ({
    path,
    module: "/workouts/workout-definition-fields",
    component: "WorkoutDefinitionFields",
  })),
  {
    path: "src/components/training/coach-planner.tsx",
    module: "/training-workout-dialog",
    component: "TrainingWorkoutDialog",
  },
]

describe("workout authoring component boundary", () => {
  // @lat: [[workout-authoring#Workout Authoring#Consumer regression guard]]
  it.each(consumers)(
    "$path renders $component",
    ({ path, module, component }) => {
      const source = ts.createSourceFile(
        path,
        readFileSync(join(appRoot, path), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const sharedImports = source.statements.flatMap((statement) => {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          !statement.moduleSpecifier.text.endsWith(module) ||
          statement.importClause?.isTypeOnly
        ) {
          return []
        }
        const bindings = statement.importClause?.namedBindings
        return bindings && ts.isNamedImports(bindings)
          ? bindings.elements
              .filter(
                (element) =>
                  !element.isTypeOnly &&
                  (element.propertyName ?? element.name).text === component,
              )
              .map((element) => element.name.text)
          : []
      })

      let rendersSharedFields = false
      const visit = (node: ts.Node): void => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          ts.isIdentifier(node.tagName) &&
          sharedImports.includes(node.tagName.text)
        ) {
          rendersSharedFields = true
        }
        ts.forEachChild(node, visit)
      }
      visit(source)

      expect(sharedImports, `Import ${component}`).not.toEqual([])
      expect(rendersSharedFields, `Render ${component}`).toBe(true)
    },
  )
})
