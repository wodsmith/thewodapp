#!/bin/bash
# Ralph - Single Iteration (HITL Mode)
# Usage: ./ralph-once.sh
#
# Runs a single Ralph iteration for human-in-the-loop development.
# Watch the output, intervene if needed, then run again.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔄 Running Ralph (HITL Mode - Single Iteration)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verify required files exist
if [ ! -f "${SCRIPT_DIR}/prompt.md" ]; then
  echo -e "${RED}Error: ${SCRIPT_DIR}/prompt.md not found${NC}"
  exit 1
fi

if [ ! -f "${SCRIPT_DIR}/prd.json" ]; then
  echo -e "${RED}Error: ${SCRIPT_DIR}/prd.json not found${NC}"
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

# Run Claude Code interactively (no --dangerously-skip-permissions)
# This allows you to approve/deny actions as needed
OUTPUT=$(cat "${SCRIPT_DIR}/prompt.md" | claude 2>&1 | tee /dev/stderr) || true

# Check for completion signal
if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
  echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ Ralph complete! All PRD items pass.${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 0
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Iteration complete. Run again with: ./ralph-once.sh"
echo -e "Or switch to AFK mode: ./ralph.sh [iterations]"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
