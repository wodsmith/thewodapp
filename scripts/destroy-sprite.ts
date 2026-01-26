#!/usr/bin/env bun
/**
 * Destroys a Sprites.dev environment and its Alchemy resources.
 *
 * Usage:
 *   bun run scripts/destroy-sprite.ts <sprite-name>
 *
 * Authentication (in order of precedence):
 *   1. SPRITES_TOKEN env var
 *   2. Auto-generated from ~/.fly/config.yml (requires FLY_ORG env var)
 *
 * If Cloudflare env vars are provided, also destroys Alchemy resources:
 *   CLOUDFLARE_ACCOUNT_ID=xxx \
 *   CLOUDFLARE_API_TOKEN=xxx \
 *   ALCHEMY_PASSWORD=xxx \
 *   bun run scripts/destroy-sprite.ts wodsmith-1234567890
 *
 * The sprite name is used as both the sprite identifier and Alchemy stage.
 */

import { SpritesClient } from "@fly/sprites";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_DIR = "/home/sprite/wodsmith";
const APP_DIR = `${PROJECT_DIR}/apps/wodsmith-start`;
const DEFAULT_CF_ACCOUNT_ID = "317fb84f366ea1ab038ca90000953697";

/**
 * Get sprites token from env var or generate from fly CLI config
 */
async function getSpritesToken(): Promise<string> {
  // 1. Check for explicit SPRITES_TOKEN
  if (process.env.SPRITES_TOKEN) {
    return process.env.SPRITES_TOKEN;
  }

  // 2. Try to read from ~/.fly/config.yml
  const flyConfigPath = join(homedir(), ".fly", "config.yml");
  if (!existsSync(flyConfigPath)) {
    console.error("Error: No SPRITES_TOKEN and ~/.fly/config.yml not found");
    console.error("Run 'sprite login' or 'fly auth login' first, or set SPRITES_TOKEN");
    process.exit(1);
  }

  const flyConfig = readFileSync(flyConfigPath, "utf-8");
  const tokenMatch = flyConfig.match(/access_token:\s*["']?([^"'\n]+)["']?/);
  if (!tokenMatch) {
    console.error("Error: Could not find access_token in ~/.fly/config.yml");
    process.exit(1);
  }

  const flyToken = tokenMatch[1];
  const orgSlug = process.env.FLY_ORG || "ian-jones";

  console.log(`Generating sprites token from fly config for org: ${orgSlug}`);
  return SpritesClient.createToken(flyToken, orgSlug);
}

async function main() {
  const token = await getSpritesToken();

  // Parse arguments
  const spriteName = process.argv[2];

  if (!spriteName) {
    console.error("Error: Sprite name is required");
    console.error("Usage: bun run scripts/destroy-sprite.ts <sprite-name>");
    process.exit(1);
  }

  // Sprite name doubles as Alchemy stage
  const alchemyStage = spriteName;

  // Check for Alchemy env vars (account ID has default)
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CF_ACCOUNT_ID;
  const hasAlchemyEnv =
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.ALCHEMY_PASSWORD;

  console.log(`Destroying sprite: ${spriteName}`);
  if (hasAlchemyEnv) {
    console.log(`Alchemy stage to destroy: ${alchemyStage}`);
  } else {
    console.log(`Alchemy cleanup: skipped (no Cloudflare env vars)`);
  }

  const client = new SpritesClient(token);
  const sprite = client.sprite(spriteName);

  // Destroy Alchemy resources first if env vars available
  if (hasAlchemyEnv) {
    console.log("\n1. Destroying Alchemy resources...");
    console.log(`   Stage: ${alchemyStage}`);

    try {
      const destroyResult = await sprite.exec(
        `STAGE=${alchemyStage} pnpm run deploy:destroy`,
        {
          cwd: APP_DIR,
          env: {
            STAGE: alchemyStage,
            CLOUDFLARE_ACCOUNT_ID: cfAccountId,
            CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
            ALCHEMY_PASSWORD: process.env.ALCHEMY_PASSWORD!,
          },
        }
      );

      if (destroyResult.stdout) {
        console.log(destroyResult.stdout);
      }
      console.log("   Alchemy resources destroyed");
    } catch (err) {
      console.error(`   Warning: Failed to destroy Alchemy resources: ${err}`);
      console.error("   Continuing with sprite destruction...");
    }
  }

  // Destroy the sprite
  console.log(`\n${hasAlchemyEnv ? "2" : "1"}. Destroying sprite...`);
  try {
    await sprite.delete();
    console.log(`   Sprite '${spriteName}' destroyed`);
  } catch (err) {
    console.error(`   Failed to destroy sprite: ${err}`);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Cleanup complete!");
  console.log("=".repeat(60));
  console.log(`\nDestroyed:`);
  if (hasAlchemyEnv) {
    console.log(`  - Alchemy stage: ${alchemyStage}`);
  }
  console.log(`  - Sprite: ${spriteName}`);
}

main().catch((err) => {
  console.error("Failed to destroy sprite:", err.message);
  process.exit(1);
});
