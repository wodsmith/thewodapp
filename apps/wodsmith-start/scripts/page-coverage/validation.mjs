import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import {
  AXES,
  DISPOSITIONS,
  EVIDENCE_KINDS,
  KINDS,
  PAGE_COVERAGE_VERSION,
  SCENARIO_STATUSES,
} from "./config.mjs"

const BROWSER_KINDS = new Set(["page", "page-layout"])
const REQUIRED_AXES = ["personas", "fixtures", "dataStates", "themes", "viewports"]

function dynamicParamNames(sourceRouteId) {
  return [...String(sourceRouteId).matchAll(/(?:^|\/)\$([A-Za-z0-9_]+)/g)].map(
    (match) => match[1],
  )
}

function defaultRequirements() {
  return {
    personas: ["unassessed"],
    fixtures: ["unassessed"],
    dataStates: ["unassessed"],
    themes: ["light"],
    viewports: ["desktop"],
  }
}

function defaultScenario(record) {
  return {
    id: "unassessed",
    status: "pending",
    persona: "unassessed",
    fixture: "unassessed",
    params: Object.fromEntries(
      dynamicParamNames(record.sourceRouteId).map((name) => [
        name,
        `__unassessed_${name}__`,
      ]),
    ),
    query: {},
    dataState: "unassessed",
    theme: "light",
    viewport: "desktop",
    evidence: [],
    blockers: [],
  }
}

function exclusionReason(record) {
  if (record.kind === "layout") return "Covered through a visual descendant route."
  if (record.kind === "api") return "Server/API handler with no browser page."
  if (record.kind === "redirect") return "Redirect-only route with no rendered component."
  if (record.kind === "navigation") return "Navigation category with no generated page."
  if (record.kind === "draft") return "Draft documentation is not published."
  if (record.kind === "service") return "Service-only endpoint with no browser page."
  return null
}

export function scaffoldPlan(discovered, existingPlan = null) {
  const discoveredById = new Map(discovered.map((record) => [record.routeId, record]))
  const existingEntries = new Map(
    (existingPlan?.entries ?? []).map((entry) => [entry.routeId, entry]),
  )
  const stale = [...existingEntries.keys()].filter((id) => !discoveredById.has(id))
  if (stale.length) {
    throw new Error(`Plan contains stale route IDs: ${stale.join(", ")}`)
  }

  const entries = discovered.map((record) => {
    const existing = existingEntries.get(record.routeId)
    if (existing) return existing
    if (BROWSER_KINDS.has(record.kind)) {
      return {
        routeId: record.routeId,
        disposition: "unassessed",
        requirements: defaultRequirements(),
        scenarios: [defaultScenario(record)],
      }
    }

    const entry = {
      routeId: record.routeId,
      disposition: record.defaultDisposition,
      requirements: {
        personas: [],
        fixtures: [],
        dataStates: [],
        themes: [],
        viewports: [],
      },
      scenarios: [],
      exclusionReason: exclusionReason(record),
    }
    if (record.kind === "layout") {
      const descendant = record.descendantRouteIds
        .map((id) => discoveredById.get(id))
        .filter((candidate) => candidate && BROWSER_KINDS.has(candidate.kind))
        .sort((left, right) => left.routeId.localeCompare(right.routeId))[0]
      entry.coveredBy = descendant ? [descendant.routeId] : []
    }
    return entry
  })

  return {
    version: PAGE_COVERAGE_VERSION,
    axes: AXES,
    evidenceKinds: EVIDENCE_KINDS,
    entries: entries.sort((left, right) => left.routeId.localeCompare(right.routeId)),
  }
}

function requireKnown(value, allowed, label, routeId) {
  if (!allowed.includes(value)) {
    throw new Error(`${routeId} has unknown ${label}: ${value}`)
  }
}

export function isRepositoryRelativeRef(
  repoRoot,
  ref,
  pathApi = { isAbsolute, relative, resolve, sep },
) {
  if (typeof ref !== "string" || !ref.trim() || pathApi.isAbsolute(ref)) {
    return false
  }
  const root = pathApi.resolve(repoRoot)
  const absolutePath = pathApi.resolve(root, ref)
  const relativePath = pathApi.relative(root, absolutePath)
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${pathApi.sep}`) &&
    !pathApi.isAbsolute(relativePath)
  )
}

async function validateEvidence(repoRoot, routeId, scenario) {
  for (const evidence of scenario.evidence) {
    if (
      !EVIDENCE_KINDS.includes(evidence?.kind) ||
      !evidence?.ref ||
      !/^[a-f0-9]{64}$/.test(evidence.sha256 ?? "")
    ) {
      throw new Error(
        `${routeId}/${scenario.id} evidence requires a known kind, repository-relative ref, and SHA-256`,
      )
    }
    if (!isRepositoryRelativeRef(repoRoot, evidence.ref)) {
      throw new Error(`${routeId}/${scenario.id} evidence escapes the repository`)
    }
    const absolutePath = resolve(repoRoot, evidence.ref)
    let contents
    try {
      contents = await readFile(absolutePath)
    } catch {
      throw new Error(`${routeId}/${scenario.id} evidence file is missing: ${evidence.ref}`)
    }
    const actual = createHash("sha256").update(contents).digest("hex")
    if (actual !== evidence.sha256) {
      throw new Error(`${routeId}/${scenario.id} evidence hash mismatch: ${evidence.ref}`)
    }
  }
}

export async function validatePlan(repoRoot, discovered, plan) {
  if (plan.version !== PAGE_COVERAGE_VERSION) {
    throw new Error(`Unsupported page coverage plan version: ${plan.version}`)
  }
  for (const [axis, values] of Object.entries(AXES)) {
    if (JSON.stringify(plan.axes?.[axis]) !== JSON.stringify(values)) {
      throw new Error(`Page coverage plan has stale or unknown ${axis} values`)
    }
  }
  if (JSON.stringify(plan.evidenceKinds) !== JSON.stringify(EVIDENCE_KINDS)) {
    throw new Error("Page coverage plan has stale or unknown evidence kinds")
  }
  const ids = discovered.map((record) => record.routeId)
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) throw new Error(`Duplicate discovered route IDs: ${duplicates.join(", ")}`)

  const discoveredById = new Map(discovered.map((record) => [record.routeId, record]))
  for (const record of discovered) {
    requireKnown(record.kind, KINDS, "classification", record.routeId)
  }
  const entries = plan.entries ?? []
  const entryIds = entries.map((entry) => entry.routeId)
  const duplicateEntries = entryIds.filter((id, index) => entryIds.indexOf(id) !== index)
  if (duplicateEntries.length) {
    throw new Error(`Duplicate plan route IDs: ${duplicateEntries.join(", ")}`)
  }
  const missing = ids.filter((id) => !entryIds.includes(id))
  const orphan = entryIds.filter((id) => !discoveredById.has(id))
  if (missing.length || orphan.length) {
    throw new Error(
      `Plan/discovery mismatch. Missing: ${missing.join(", ") || "none"}. Orphan: ${orphan.join(", ") || "none"}.`,
    )
  }

  const entryById = new Map(entries.map((entry) => [entry.routeId, entry]))
  for (const record of discovered) {
    const entry = entryById.get(record.routeId)
    requireKnown(entry.disposition, DISPOSITIONS, "disposition", record.routeId)
    const visualDispositions = [
      "unassessed",
      "shared-library",
      "library-candidate",
      "route-specific",
    ]
    if (
      (BROWSER_KINDS.has(record.kind) &&
        !visualDispositions.includes(entry.disposition)) ||
      (!BROWSER_KINDS.has(record.kind) &&
        entry.disposition !== record.defaultDisposition)
    ) {
      throw new Error(
        `${record.routeId} disposition ${entry.disposition} is incompatible with ${record.kind}`,
      )
    }
    if (!Array.isArray(entry.scenarios)) {
      throw new Error(`${record.routeId} scenarios must be an array`)
    }
    if (BROWSER_KINDS.has(record.kind) && entry.scenarios.length === 0) {
      throw new Error(`${record.routeId} page/page-layout requires a scenario placeholder`)
    }
    if (!BROWSER_KINDS.has(record.kind) && entry.scenarios.length !== 0) {
      throw new Error(`${record.routeId} non-page decision must have scenarios []`)
    }
    if (!BROWSER_KINDS.has(record.kind) && !entry.exclusionReason?.trim()) {
      throw new Error(`${record.routeId} exclusion requires a reason`)
    }

    if (entry.disposition === "layout-only") {
      if (!entry.coveredBy?.length) {
        throw new Error(`${record.routeId} layout-only entry requires coveredBy`)
      }
      for (const coveredBy of entry.coveredBy) {
        const descendant = discoveredById.get(coveredBy)
        if (
          !descendant ||
          !record.descendantRouteIds.includes(coveredBy) ||
          !BROWSER_KINDS.has(descendant.kind)
        ) {
          throw new Error(`${record.routeId} has invalid coveredBy descendant: ${coveredBy}`)
        }
      }
    }

    const requirements = entry.requirements ?? {}
    for (const axis of REQUIRED_AXES) {
      const allowed = AXES[axis]
      const requiredValues = requirements[axis]
      if (!Array.isArray(requiredValues)) {
        throw new Error(`${record.routeId} requirements.${axis} must be an array`)
      }
      for (const value of requiredValues) requireKnown(value, allowed, axis, record.routeId)
    }

    if (
      entry.scenarios.some(
        (scenario) => typeof scenario?.id !== "string" || !scenario.id.trim(),
      )
    ) {
      throw new Error(`${record.routeId} scenario IDs must be non-empty strings`)
    }
    const scenarioIds = entry.scenarios.map((scenario) => scenario.id)
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      throw new Error(`${record.routeId} has duplicate scenario IDs`)
    }
    const params = dynamicParamNames(record.sourceRouteId)
    for (const scenario of entry.scenarios) {
      requireKnown(scenario.status, SCENARIO_STATUSES, "scenario status", record.routeId)
      requireKnown(scenario.persona, AXES.personas, "persona", record.routeId)
      requireKnown(scenario.fixture, AXES.fixtures, "fixture", record.routeId)
      requireKnown(scenario.dataState, AXES.dataStates, "data state", record.routeId)
      requireKnown(scenario.theme, AXES.themes, "theme", record.routeId)
      requireKnown(scenario.viewport, AXES.viewports, "viewport", record.routeId)
      if (!scenario.query || Array.isArray(scenario.query) || typeof scenario.query !== "object") {
        throw new Error(`${record.routeId}/${scenario.id} query must be an object`)
      }
      for (const param of params) {
        if (typeof scenario.params?.[param] !== "string" || !scenario.params[param].trim()) {
          throw new Error(`${record.routeId}/${scenario.id} requires dynamic param ${param}`)
        }
      }
      if (!Array.isArray(scenario.evidence) || !Array.isArray(scenario.blockers)) {
        throw new Error(`${record.routeId}/${scenario.id} evidence and blockers must be arrays`)
      }
      if (scenario.status === "verified" && scenario.evidence.length === 0) {
        throw new Error(`${record.routeId}/${scenario.id} verified scenario requires evidence`)
      }
      if (scenario.status === "verified" && scenario.blockers.length > 0) {
        throw new Error(`${record.routeId}/${scenario.id} verified scenario cannot have blockers`)
      }
      if (scenario.status === "pending" && scenario.blockers.length > 0) {
        throw new Error(`${record.routeId}/${scenario.id} pending scenario cannot have blockers`)
      }
      if (
        scenario.status === "blocked" &&
        (scenario.blockers.length === 0 ||
          scenario.blockers.some((blocker) => !blocker?.code?.trim() || !blocker?.detail?.trim()))
      ) {
        throw new Error(`${record.routeId}/${scenario.id} blocked scenario requires code/detail`)
      }
      await validateEvidence(repoRoot, record.routeId, scenario)
    }

    for (const axis of REQUIRED_AXES) {
      const scenarioField =
        axis === "personas"
          ? "persona"
          : axis === "fixtures"
            ? "fixture"
            : axis === "dataStates"
              ? "dataState"
              : axis === "themes"
                ? "theme"
                : "viewport"
      for (const required of requirements[axis]) {
        if (!entry.scenarios.some((scenario) => scenario[scenarioField] === required)) {
          throw new Error(`${record.routeId} is missing required ${axis} coverage: ${required}`)
        }
      }
    }
  }
}

export function joinLedger(discovered, plan) {
  const entryById = new Map(plan.entries.map((entry) => [entry.routeId, entry]))
  return discovered.map((record) => {
    const { defaultDisposition, descendantRouteIds, ...identity } = record
    return { ...identity, ...entryById.get(record.routeId) }
  })
}
