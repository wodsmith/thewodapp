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
 * Only production gets a custom domain.
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

export default website

await app.finalize()
