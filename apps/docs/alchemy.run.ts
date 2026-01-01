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

const app = await alchemy('wodsmith-docs', {
  stage,
  phase: process.argv.includes('--destroy') ? 'destroy' : 'up',
  stateStore: process.env.CI
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
})

/**
 * Determines the custom domain for the docs site.
 */
function getDomains(currentStage: string): string[] | undefined {
  if (currentStage === 'prod') {
    return ['docs.wodsmith.com']
  }
  if (currentStage.startsWith('pr-')) {
    return [`${currentStage}-docs.preview.wodsmith.com`]
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
 */
if (process.env.PULL_REQUEST) {
  const prNumber = Number(process.env.PULL_REQUEST)
  const previewUrl = `https://pr-${prNumber}-docs.preview.wodsmith.com`
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown'

  await GitHubComment('preview-comment', {
    owner: 'wodsmith',
    repository: 'thewodapp',
    issueNumber: prNumber,
    body: `## 📚 Docs Preview Deployed

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
