import { readFileSync, readdirSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(packageRoot, "../..")
const manifestPath = join(
  packageRoot,
  "guardrails/shared-operation-drift-manifest.json",
)
const appRoots = [
  join(repositoryRoot, "apps/crew/src/server-fns"),
  join(repositoryRoot, "apps/wodsmith-start/src/server-fns"),
]
const classifications = new Set([
  "pending-review",
  "intentional-policy",
  "bug-fix-to-propagate",
  "accidental",
])

function sourceFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? sourceFiles(root, path) : [relative(root, path)]
    })
    .filter((path) => [".js", ".jsx", ".ts", ".tsx"].includes(extname(path)))
    .sort()
}

const [crewFiles, startFiles] = appRoots.map(
  (root) => new Set(sourceFiles(root)),
)
const divergentPeers = [...crewFiles]
  .filter((path) => startFiles.has(path))
  .filter(
    (path) =>
      readFileSync(join(appRoots[0], path), "utf8") !==
      readFileSync(join(appRoots[1], path), "utf8"),
  )
  .sort()

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const recorded = new Map(manifest.peers.map((peer) => [peer.path, peer]))
const errors = []

for (const path of divergentPeers) {
  const peer = recorded.get(path)
  if (!peer) {
    errors.push(`new unclassified divergence: ${path}`)
    continue
  }
  if (!classifications.has(peer.classification)) {
    errors.push(`invalid or missing classification for ${path}`)
  }
  if (!Array.isArray(peer.operations) || peer.operations.length === 0) {
    errors.push(`missing operation inventory or placeholder for ${path}`)
  }
}

if (errors.length > 0) {
  console.error("Shared operation drift guard failed:\n")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const resolvedPeers = [...recorded.keys()].filter(
  (path) => !divergentPeers.includes(path),
).length
console.log(
  `Shared operation drift guard passed (${divergentPeers.length} classified peers, ${resolvedPeers} resolved).`,
)
