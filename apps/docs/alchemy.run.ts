/**
 * Alchemy Infrastructure-as-Code configuration for wodsmith-docs.
 *
 * Deploys the Docusaurus documentation site to Cloudflare Workers
 * with static asset serving.
 */

import alchemy from 'alchemy'
import {Website} from 'alchemy/cloudflare'
import {GitHubComment} from 'alchemy/github'
import {CloudflareStateStore} from 'alchemy/state'

const stage = process.env.STAGE ?? 'dev'

const app = await alchemy('wodsmith', {
  stage,
  phase: process.argv.includes('--destroy') ? 'destroy' : 'up',
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
})

/**
 * Determines the custom domain for the docs site.
 * Only production gets a custom domain - PR previews use the default workers.dev URL.
 *
 * Domains are specified as objects with explicit adopt: true to handle
 * cases where the domain binding already exists in Cloudflare.
 */
function getDomains(
  currentStage: string,
): Array<{domainName: string; adopt: boolean; override: boolean}> | undefined {
  if (currentStage === 'prod') {
    return [{domainName: 'docs.wodsmith.com', adopt: true, override: true}]
  }
  return undefined
}

/**
 * Static docs site deployed to Cloudflare Workers.
 */
const website = await Website('docs', {
  // Build is handled by the CI workflow before deploy
  assets: './build',
  domains: getDomains(stage),
  adopt: true,
})

/**
 * GitHub PR comment with preview URL for pull request deployments.
 * Uses the default workers.dev URL (no custom domain for previews).
 */
if (process.env.PULL_REQUEST) {
  const prNumber = Number(process.env.PULL_REQUEST)
  const previewUrl = website.url
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown'

  await GitHubComment('preview-comment', {
    owner: 'wodsmith',
    repository: 'thewodapp',
    issueNumber: prNumber,
    body: `## Docs Preview Deployed

**URL:** ${previewUrl}

| Detail | Value |
|--------|-------|
| Commit | \`${commitSha}\` |
| Stage | \`pr-${prNumber}\` |
| Deployed | ${new Date().toISOString()} |

---
_This comment is automatically updated on each push to this PR._`,
  })
}

await app.finalize()
