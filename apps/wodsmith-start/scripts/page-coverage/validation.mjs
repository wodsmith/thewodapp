import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import {
  AXES,
  CAPTURE_VIEWPORTS,
  DISPOSITIONS,
  EVIDENCE_KINDS,
  KINDS,
  PAGE_COVERAGE_VERSION,
  SCENARIO_STATUSES,
} from "./config.mjs"

const BROWSER_KINDS = new Set(["page", "page-layout"])
const LIVE_BROWSER_EVIDENCE_KINDS = new Set([
  "browser-screenshot",
  "accessibility-snapshot",
  "dom-snapshot",
  "console-log",
  "network-log",
  "redirect-trace",
])
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

async function validateEvidence(repoRoot, record, scenario) {
  const routeId = record.routeId
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
    if (evidence.kind === "capture-manifest") {
      let manifest
      try {
        manifest = JSON.parse(contents.toString("utf8"))
      } catch {
        throw new Error(`${routeId}/${scenario.id} capture manifest must be valid JSON`)
      }
      const capture = manifest.version === 1
        ? manifest.captures?.find((candidate) => candidate.id === evidence.captureId)
        : null
      if (!capture) {
        throw new Error(
          `${routeId}/${scenario.id} capture manifest is missing captureId ${evidence.captureId ?? "undefined"}`,
        )
      }
      const requestedUrl = safeUrl(capture.requestedUrl)
      const finalUrl = safeUrl(capture.finalUrl)
      const viewport = capture.viewport
      if (
        capture.routeId !== routeId ||
        capture.scenarioId !== scenario.id ||
        !capture.environment?.trim() ||
        !requestedUrl ||
        !finalUrl ||
        capture.host !== finalUrl.hostname ||
        !Number.isFinite(Date.parse(capture.capturedAt)) ||
        !Number.isInteger(viewport?.width) ||
        viewport.width <= 0 ||
        !Number.isInteger(viewport?.height) ||
        viewport.height <= 0 ||
        !CAPTURE_VIEWPORTS[viewport.profile] ||
        !AXES.themes.includes(capture.requestedColorScheme) ||
        !AXES.themes.includes(capture.effectiveColorScheme) ||
        capture.requestedColorScheme !== scenario.theme ||
        (scenario.status === "verified" &&
          capture.effectiveColorScheme !== scenario.theme) ||
        !capture.deploymentRevision?.trim() ||
        !capture.tool?.trim()
      ) {
        throw new Error(
          `${routeId}/${scenario.id} capture provenance is incomplete or mismatched`,
        )
      }
      if (!requestedUrlMatches(record, scenario, requestedUrl)) {
        throw new Error(
          `${routeId}/${scenario.id} capture requested URL does not match route scenario`,
        )
      }
      const viewportProfile = CAPTURE_VIEWPORTS[scenario.viewport]
      if (
        viewport.profile !== scenario.viewport ||
        viewport.width !== viewportProfile.width ||
        viewport.height !== viewportProfile.height
      ) {
        throw new Error(
          `${routeId}/${scenario.id} capture viewport does not match scenario profile`,
        )
      }
      const claimedArtifacts = scenario.evidence.filter((candidate) =>
        LIVE_BROWSER_EVIDENCE_KINDS.has(candidate.kind),
      )
      if (
        !Array.isArray(capture.artifacts) ||
        capture.artifacts.length !== claimedArtifacts.length ||
        claimedArtifacts.some(
          (claimed) =>
            !capture.artifacts.some(
              (recorded) =>
                recorded.kind === claimed.kind &&
                recorded.ref === claimed.ref &&
                recorded.sha256 === claimed.sha256,
            ),
        )
      ) {
        throw new Error(
          `${routeId}/${scenario.id} capture provenance does not match scenario evidence`,
        )
      }
    }
  }

  const hasLiveBrowserEvidence = scenario.evidence.some((evidence) =>
    LIVE_BROWSER_EVIDENCE_KINDS.has(evidence.kind),
  )
  const hasCaptureManifest = scenario.evidence.some(
    (evidence) => evidence.kind === "capture-manifest",
  )
  if (hasLiveBrowserEvidence && !hasCaptureManifest) {
    const qualifier = scenario.status === "verified" ? "verified browser scenario" : "browser evidence"
    throw new Error(`${routeId}/${scenario.id} ${qualifier} requires capture provenance`)
  }
}

function requestedUrlMatches(record, scenario, requestedUrl) {
  let pathname = record.urlPattern
  for (const param of dynamicParamNames(record.sourceRouteId)) {
    pathname = pathname.replace(`:${param}`, encodeURIComponent(scenario.params[param]))
  }
  const expectedQuery = new URLSearchParams()
  for (const key of Object.keys(scenario.query).sort()) {
    const value = scenario.query[key]
    for (const item of Array.isArray(value) ? value : [value]) {
      expectedQuery.append(key, item === null || item === undefined ? "" : String(item))
    }
  }
  const actualQuery = new URLSearchParams(requestedUrl.search)
  actualQuery.sort()
  return (
    requestedUrl.pathname === pathname &&
    actualQuery.toString() === expectedQuery.toString()
  )
}

async function filesUnder(repoRoot, directoryRef) {
  const directory = resolve(repoRoot, directoryRef)
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true })
    return (
      await Promise.all(
        entries.map(async (entry) => {
          const path = resolve(current, entry.name)
          return entry.isDirectory() ? walk(path) : [relative(repoRoot, path)]
        }),
      )
    ).flat()
  }
  return walk(directory)
}

async function validateManifestCoverage(repoRoot, entries) {
  const scenarios = entries.flatMap((entry) => entry.scenarios)
  const claimsByRef = new Map()
  for (const scenario of scenarios) {
    for (const evidence of scenario.evidence) {
      if (evidence.kind !== "capture-manifest") continue
      const claims = claimsByRef.get(evidence.ref) ?? []
      claims.push(evidence)
      claimsByRef.set(evidence.ref, claims)
    }
  }

  const expectedFilesByDirectory = new Map()
  for (const [manifestRef, claims] of claimsByRef) {
    if (new Set(claims.map((claim) => claim.sha256)).size !== 1) {
      throw new Error(`${manifestRef} capture manifest claims must use one SHA-256`)
    }
    const manifest = JSON.parse(await readFile(resolve(repoRoot, manifestRef), "utf8"))
    const captureIds = manifest.captures?.map((capture) => capture.id) ?? []
    if (
      captureIds.some((id) => typeof id !== "string" || !id.trim()) ||
      new Set(captureIds).size !== captureIds.length
    ) {
      throw new Error(`${manifestRef} capture manifest IDs must be unique non-empty strings`)
    }
    const claimedIds = claims.map((claim) => claim.captureId)
    if (new Set(claimedIds).size !== claimedIds.length) {
      throw new Error(`${manifestRef} capture IDs must be referenced exactly once`)
    }
    const unreferenced = captureIds.filter((id) => !claimedIds.includes(id))
    if (unreferenced.length) {
      throw new Error(
        `${manifestRef} capture manifest has unreferenced captures: ${unreferenced.join(", ")}`,
      )
    }

    const directoryRef = dirname(manifestRef)
    const expectedFiles = expectedFilesByDirectory.get(directoryRef) ?? new Set()
    expectedFiles.add(manifestRef)
    if (manifest.captures.some((capture) => !Array.isArray(capture.artifacts))) {
      throw new Error(`${manifestRef} capture manifest artifacts must be arrays`)
    }
    const artifactRefs = manifest.captures.flatMap((capture) =>
      capture.artifacts.map((artifact) => artifact.ref),
    )
    if (new Set(artifactRefs).size !== artifactRefs.length) {
      throw new Error(`${manifestRef} capture artifact refs must be unique`)
    }
    for (const artifactRef of artifactRefs) {
      if (
        artifactRef !== directoryRef &&
        !artifactRef.startsWith(`${directoryRef}${sep}`) &&
        !artifactRef.startsWith(`${directoryRef}/`)
      ) {
        throw new Error(`${manifestRef} capture artifact escapes its evidence directory`)
      }
      expectedFiles.add(artifactRef)
    }
    expectedFilesByDirectory.set(directoryRef, expectedFiles)
  }

  for (const [directoryRef, expectedFiles] of expectedFilesByDirectory) {
    const actualFiles = await filesUnder(repoRoot, directoryRef)
    const orphan = actualFiles.filter((file) => !expectedFiles.has(file))
    if (orphan.length) {
      throw new Error(
        `${directoryRef} capture manifest directory has unreferenced evidence files: ${orphan.join(", ")}`,
      )
    }
  }
}

function safeUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
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
      await validateEvidence(repoRoot, record, scenario)
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
  await validateManifestCoverage(repoRoot, entries)
}

export function joinLedger(discovered, plan) {
  const entryById = new Map(plan.entries.map((entry) => [entry.routeId, entry]))
  return discovered.map((record) => {
    const { defaultDisposition, descendantRouteIds, ...identity } = record
    return { ...identity, ...entryById.get(record.routeId) }
  })
}
