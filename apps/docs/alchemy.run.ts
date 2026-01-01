/**
 * Alchemy Infrastructure-as-Code configuration for wodsmith-docs.
 *
 * Deploys the Docusaurus documentation site to Cloudflare Workers
 * with static asset serving.
 */

import alchemy from 'alchemy'
import {Website} from 'alchemy/cloudflare'
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
function getDomain(currentStage: string): string[] | undefined {
  if (currentStage === 'prod') {
    return ['docs.wodsmith.com']
  }
  return undefined
}

/**
 * Static docs site deployed to Cloudflare Workers.
 */
await Website('docs', {
  // Build is handled by the CI workflow before deploy
  assets: './build',
  domains: getDomain(stage),
  adopt: true,
})

await app.finalize()
