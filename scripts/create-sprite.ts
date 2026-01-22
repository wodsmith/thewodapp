#!/usr/bin/env bun
/**
 * Creates a Sprites.dev environment with the wodsmith repo cloned, a new branch,
 * and optionally sets up Alchemy for deploying a preview environment.
 *
 * Usage:
 *   bun run scripts/create-sprite.ts [branch-name] [--checkout]
 *
 * Options:
 *   --checkout    Checkout an existing branch instead of creating a new one
 *
 * Authentication (in order of precedence):
 *   1. SPRITES_TOKEN env var
 *   2. Auto-generated from ~/.fly/config.yml (requires FLY_ORG env var)
 *
 * For Alchemy deployment inside the sprite, also provide:
 *   CLOUDFLARE_ACCOUNT_ID=xxx
 *   CLOUDFLARE_API_TOKEN=xxx
 *   ALCHEMY_PASSWORD=xxx
 *
 * If no branch name is provided, generates one like: claude/sprite-{timestamp}
 */

import { SpritesClient, Sprite } from "@fly/sprites";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Use HTTPS for public repo (no auth needed for clone)
const REPO_URL = "https://github.com/wodsmith/thewodapp.git";
const PROJECT_DIR = "/home/sprite/wodsmith";
const APP_DIR = `${PROJECT_DIR}/apps/wodsmith-start`;
const DEFAULT_CF_ACCOUNT_ID = "317fb84f366ea1ab038ca90000953697";

/**
 * Create a checkpoint for a sprite using SDK
 * TODO: Re-enable when SDK version supports checkpoint streaming
 */
async function createCheckpoint(_sprite: Sprite, comment: string): Promise<boolean> {
  // SDK 0.0.1 doesn't have working checkpoint stream methods
  console.log(`   Checkpoint skipped (${comment}) - SDK 0.0.1 doesn't support streaming`);
  return false;
}

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
  const args = process.argv.slice(2);
  const checkoutExisting = args.includes("--checkout");
  const branchArg = args.find(arg => !arg.startsWith("--"));

  // Generate unique identifiers - sprite name doubles as Alchemy stage
  const timestamp = Date.now();
  const branchName = branchArg || `claude/sprite-${timestamp}`;
  const spriteName = `wodsmith-${timestamp}`;
  const alchemyStage = spriteName; // Use same name for both

  // Check for Alchemy env vars (account ID has default)
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CF_ACCOUNT_ID;
  const hasAlchemyEnv =
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.ALCHEMY_PASSWORD;

  console.log(`Creating sprite: ${spriteName}`);
  console.log(`Branch name: ${branchName}`);
  console.log(`Alchemy deployment: ${hasAlchemyEnv ? "enabled" : "disabled (missing env vars)"}`);

  const client = new SpritesClient(token);

  // Create the sprite
  console.log("\n1. Creating sprite...");
  const sprite = await client.createSprite(spriteName);
  console.log(`   Sprite created: ${spriteName}`);

  // Set up git config
  console.log("\n2. Configuring git...");
  await sprite.exec('git config --global user.email "claude@anthropic.com"');
  await sprite.exec('git config --global user.name "Claude"');

  // Configure GitHub token for push access if provided
  if (process.env.GITHUB_TOKEN) {
    await sprite.exec(`git config --global url."https://${process.env.GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"`);
    console.log("   GitHub token configured for push access");
  }

  // Clone the repository
  console.log("\n3. Cloning wodsmith repository...");
  try {
    const cloneResult = await sprite.exec(`git clone ${REPO_URL} ${PROJECT_DIR}`);
    if (cloneResult.stderr) {
      console.log(`   Clone output: ${cloneResult.stderr}`);
    }
    console.log(`   Repository cloned to ${PROJECT_DIR}`);
  } catch (err: any) {
    console.error(`   Git clone failed: ${err.message}`);
    if (err.stdout) console.error(`   stdout: ${err.stdout}`);
    if (err.stderr) console.error(`   stderr: ${err.stderr}`);
    throw err;
  }

  // Create or checkout branch
  try {
    if (checkoutExisting) {
      console.log(`\n4. Checking out existing branch: ${branchName}`);
      const checkoutResult = await sprite.exec(`git checkout ${branchName}`, { cwd: PROJECT_DIR });
      if (checkoutResult.stderr) {
        console.log(`   ${checkoutResult.stderr.trim()}`);
      }
      console.log(`   Branch '${branchName}' checked out`);
    } else {
      console.log(`\n4. Creating branch: ${branchName}`);
      const branchResult = await sprite.exec(`git checkout -b ${branchName}`, { cwd: PROJECT_DIR });
      if (branchResult.stderr) {
        console.log(`   ${branchResult.stderr.trim()}`);
      }
      console.log(`   Branch '${branchName}' created and checked out`);
    }
  } catch (err: any) {
    console.error(`   Git checkout failed: ${err.message}`);
    if (err.stdout) console.error(`   stdout: ${err.stdout}`);
    if (err.stderr) console.error(`   stderr: ${err.stderr}`);
    throw err;
  }

  // Checkpoint after initial setup (before dependencies)
  console.log("\n   Creating checkpoint: post-clone...");
  if (await createCheckpoint(sprite, "post-clone")) {
    console.log("   Checkpoint created");
  }

  // Install pnpm, bun, and update claude
  console.log("\n5. Installing pnpm, bun, and updating claude...");

  try {
    console.log("   Installing pnpm...");
    const pnpmInstall = await sprite.exec("curl -fsSL https://get.pnpm.io/install.sh | bash");
    if (pnpmInstall.stdout) console.log(`   ${pnpmInstall.stdout.trim()}`);
    if (pnpmInstall.stderr) console.log(`   ${pnpmInstall.stderr.trim()}`);
  } catch (err: any) {
    console.error(`   pnpm install failed: ${err.message}`);
    if (err.stdout) console.error(`   stdout: ${err.stdout}`);
    if (err.stderr) console.error(`   stderr: ${err.stderr}`);
    throw err;
  }

  try {
    console.log("   Installing bun...");
    const bunInstall = await sprite.exec("curl -fsSL https://bun.sh/install | bash");
    if (bunInstall.stdout) console.log(`   ${bunInstall.stdout.trim()}`);
    if (bunInstall.stderr) console.log(`   ${bunInstall.stderr.trim()}`);
  } catch (err: any) {
    console.error(`   bun install failed: ${err.message}`);
    if (err.stdout) console.error(`   stdout: ${err.stdout}`);
    if (err.stderr) console.error(`   stderr: ${err.stderr}`);
    throw err;
  }

  // claude install might not be available in the sprite, make it optional
  try {
    console.log("   Updating claude...");
    await sprite.exec("which claude && claude install || echo 'claude not found, skipping'");
  } catch {
    console.log("   claude not installed, skipping update");
  }
  // Add pnpm and bun to PATH for this session
  const pnpmHome = "/home/sprite/.local/share/pnpm";
  const bunHome = "/home/sprite/.bun/bin";
  const pathEnv = { PATH: `${pnpmHome}:${bunHome}:${process.env.PATH}` };

  // Install dependencies
  console.log("\n6. Installing dependencies...");
  const installResult = await sprite.exec("pnpm install --frozen-lockfile", {
    cwd: PROJECT_DIR,
    env: pathEnv,
  });
  if (installResult.stderr && !installResult.stderr.includes("WARN")) {
    console.log(`   Install stderr: ${installResult.stderr}`);
  }
  console.log("   Dependencies installed");

  // Checkpoint after dependencies installed
  console.log("\n   Creating checkpoint: post-install...");
  if (await createCheckpoint(sprite, "post-install")) {
    console.log("   Checkpoint created");
  }

  // Set up Alchemy environment if credentials provided
  if (hasAlchemyEnv) {
    console.log("\n7. Setting up Alchemy environment...");

    // The workers.dev URL pattern for this stage
    const appUrl = `https://wodsmith-app-${alchemyStage}.zacjones93.workers.dev`;

    // Create .dev.vars with required env vars for Alchemy deployment
    const devVars = `# Alchemy IaC configuration for sprite environment
# Auto-generated by create-sprite.ts

# Cloudflare credentials
CLOUDFLARE_ACCOUNT_ID=${cfAccountId}
CLOUDFLARE_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN}

# Alchemy state encryption
ALCHEMY_PASSWORD=${process.env.ALCHEMY_PASSWORD}

# App configuration
APP_URL=${appUrl}

# Optional: Add these for full functionality
# TURNSTILE_SECRET_KEY=
# RESEND_API_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_PUBLISHABLE_KEY=
# STRIPE_CLIENT_ID=
`;

    // Write .dev.vars file
    await sprite.exec(`cat > ${APP_DIR}/.dev.vars << 'DEVVARS'
${devVars}
DEVVARS`, { cwd: PROJECT_DIR });
    console.log("   Created .dev.vars with Cloudflare credentials");

    // Deploy the Alchemy environment
    console.log("\n8. Deploying Alchemy environment...");
    console.log(`   Stage: ${alchemyStage}`);
    console.log(`   This may take a few minutes...`);

    const deployResult = await sprite.exec(`STAGE=${alchemyStage} pnpm run deploy`, {
      cwd: APP_DIR,
      env: {
        ...pathEnv,
        STAGE: alchemyStage,
        CLOUDFLARE_ACCOUNT_ID: cfAccountId,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
        ALCHEMY_PASSWORD: process.env.ALCHEMY_PASSWORD!,
        APP_URL: appUrl,
      },
    });

    if (deployResult.stdout) {
      console.log(deployResult.stdout);
    }
    if (deployResult.stderr) {
      console.log(`   Deploy stderr: ${deployResult.stderr}`);
    }
    console.log("   Alchemy deployment complete!");
  }

  // Verify the setup
  console.log("\n" + (hasAlchemyEnv ? "9" : "7") + ". Verifying setup...");
  const branchCheck = await sprite.exec("git branch --show-current", { cwd: PROJECT_DIR });
  console.log(`   Current branch: ${branchCheck.stdout.trim()}`);

  const statusCheck = await sprite.exec("git status --short", { cwd: PROJECT_DIR });
  console.log(`   Git status: ${statusCheck.stdout.trim() || "(clean)"}`);

  // Print connection info
  console.log("\n" + "=".repeat(60));
  console.log("Sprite ready!");
  console.log("=".repeat(60));
  console.log(`\nSprite name: ${spriteName}`);
  console.log(`Branch: ${branchName}`);
  console.log(`Working directory: ${PROJECT_DIR}`);

  if (hasAlchemyEnv) {
    console.log(`Preview URL: https://wodsmith-app-${spriteName}.zacjones93.workers.dev`);
  }

  console.log(`\nTo connect via CLI:`);
  console.log(`  sprite console ${spriteName}`);
  console.log(`\nTo execute commands:`);
  console.log(`  sprite exec ${spriteName} -- <command>`);

  if (hasAlchemyEnv) {
    console.log(`\nTo run dev server inside sprite:`);
    console.log(`  sprite exec ${spriteName} -- bash -c "cd ${APP_DIR} && pnpm dev"`);
  }

  console.log(`\nTo destroy (sprite + Alchemy resources):`);
  console.log(`  bun run scripts/destroy-sprite.ts ${spriteName}`);
}

main().catch((err) => {
  console.error("Failed to create sprite:", err.message);
  process.exit(1);
});
