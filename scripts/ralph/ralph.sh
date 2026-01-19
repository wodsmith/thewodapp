#!/bin/bash
# Ralph - Autonomous AI Coding Loop (AFK Mode)
# Usage: ./ralph.sh [max_iterations]
#
# Runs Claude Code in a loop until all PRD items pass or max iterations reached.
# For human-in-the-loop mode, use ralph-once.sh instead.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS=${1:-10}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🚀 Starting Ralph (AFK Mode)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Max iterations: ${MAX_ITERATIONS}"
echo -e "Prompt: ${SCRIPT_DIR}/prompt.md"
echo -e "PRD: ${SCRIPT_DIR}/prd.json"
echo -e "Progress: ${SCRIPT_DIR}/progress.txt"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verify required files exist
if [ ! -f "${SCRIPT_DIR}/prompt.md" ]; then
  echo -e "${RED}Error: ${SCRIPT_DIR}/prompt.md not found${NC}"
  echo "Run the init-ralph.ts script first to initialize Ralph in your project."
  exit 1
fi

if [ ! -f "${SCRIPT_DIR}/prd.json" ]; then
  echo -e "${RED}Error: ${SCRIPT_DIR}/prd.json not found${NC}"
  echo "Create a prd.json file with your user stories."
  exit 1
fi

# Create progress.txt if it doesn't exist
if [ ! -f "${SCRIPT_DIR}/progress.txt" ]; then
  echo "# Ralph Progress Log" > "${SCRIPT_DIR}/progress.txt"
  echo "Started: $(date +%Y-%m-%d)" >> "${SCRIPT_DIR}/progress.txt"
  echo "" >> "${SCRIPT_DIR}/progress.txt"
  echo "## Codebase Patterns" >> "${SCRIPT_DIR}/progress.txt"
  echo "(Patterns discovered during this session will be added here)" >> "${SCRIPT_DIR}/progress.txt"
  echo "" >> "${SCRIPT_DIR}/progress.txt"
  echo "---" >> "${SCRIPT_DIR}/progress.txt"
fi

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo -e "Branch: ${CURRENT_BRANCH}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo -e "\n${BLUE}═══════════════════ Iteration $i of $MAX_ITERATIONS ═══════════════════${NC}\n"

  # Run Claude Code with the prompt
  # Using --dangerously-skip-permissions for full automation
  OUTPUT=$(cat "${SCRIPT_DIR}/prompt.md" | claude -p \
    --dangerously-skip-permissions \
    2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Ralph complete! All PRD items pass.${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
  fi

  # Brief pause between iterations to avoid rate limiting
  sleep 2
done

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  Max iterations ($MAX_ITERATIONS) reached${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Check progress:"
echo "  cat ${SCRIPT_DIR}/prd.json | jq '.userStories[] | {id, title, passes}'"
echo "  cat ${SCRIPT_DIR}/progress.txt"
echo ""
exit 1
