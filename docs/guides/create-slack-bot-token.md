# Creating a Slack Bot Token
## Step 1: Create a Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Enter:
   - App Name: WODsmith Deploy Bot (or whatever you want)
   - Workspace: Select your workspace
5. Click "Create App"
---
## Step 2: Add OAuth Scopes
1. In the left sidebar, click "OAuth & Permissions"
2. Scroll down to "Scopes" → "Bot Token Scopes"
3. Click "Add an OAuth Scope" and add:
   - chat:write (required - post messages)
   - chat:write.public (recommended - post to public channels without joining)
---
## Step 3: Install to Workspace
1. Scroll back up to "OAuth Tokens for Your Workspace"
2. Click "Install to Workspace"
3. Review permissions and click "Allow"
4. Copy the "Bot User OAuth Token" (starts with xoxb-)
---
## Step 4: Add to GitHub Secrets
 Option A: Using gh CLI
```bash
gh secret set SLACK_BOT_TOKEN
```
 Paste the xoxb-... token when prompted
 Option B: GitHub UI
```
 Settings → Secrets and variables → Actions → New repository secret
 Name: SLACK_BOT_TOKEN
 Value: xoxb-your-token-here
```
---
## Step 5: Get Channel ID (for SLACK_CHANNEL_ID)
1. In Slack, right-click the channel you want notifications in (e.g., #deploys)
2. Click "View channel details"
3. Scroll to the bottom - the Channel ID is there (starts with C)
4. Add it as a secret:
```bash
gh secret set SLACK_CHANNEL_ID
```
 Paste the C... channel ID