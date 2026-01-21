#!/bin/bash

# Ralph Agent Loop Runner
# Runs claude in a loop using prompt.md until PRD.json shows passes: true
# Usage: ./ralph.sh [max_iterations]

set -e

# Configuration
MAX_ITERATIONS="${1:-100}"
ITERATION=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
PRD_FILE="$SCRIPT_DIR/PRD.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check required files
if [ ! -f "$PROMPT_FILE" ]; then
    echo -e "${RED}Error: $PROMPT_FILE not found${NC}"
    exit 1
fi

if [ ! -f "$PRD_FILE" ]; then
    echo -e "${RED}Error: $PRD_FILE not found${NC}"
    exit 1
fi

# Initialize progress.txt if missing
if [ ! -f "$PROGRESS_FILE" ]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "" >> "$PROGRESS_FILE"
    echo -e "${YELLOW}Created $PROGRESS_FILE${NC}"
fi

# Check if PRD is complete (global passes: true OR all stories pass)
check_prd_complete() {
    if [ ! -f "$PRD_FILE" ]; then
        return 1
    fi

    # Check for global "passes": true
    if grep -q '"passes"[[:space:]]*:[[:space:]]*true' "$PRD_FILE" | head -1 | grep -v "userStories" > /dev/null 2>&1; then
        # More precise: check if there's a top-level passes: true (not inside userStories)
        local global_passes=$(jq -r '.passes // false' "$PRD_FILE" 2>/dev/null)
        if [ "$global_passes" = "true" ]; then
            echo -e "${GREEN}Global passes: true${NC}"
            return 0
        fi
    fi

    # Check if all user stories pass
    local failed_count=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null)
    if [ "$failed_count" = "0" ]; then
        echo -e "${GREEN}All user stories pass${NC}"
        return 0
    fi

    echo -e "${BLUE}Remaining stories: $failed_count${NC}"
    return 1
}

# Get current progress summary
get_progress_summary() {
    local total=$(jq '.userStories | length' "$PRD_FILE" 2>/dev/null)
    local passed=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null)
    local next_story=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE" 2>/dev/null)

    echo -e "${BLUE}Progress: $passed/$total stories complete${NC}"
    if [ "$next_story" != "null: null" ] && [ -n "$next_story" ]; then
        echo -e "${BLUE}Next: $next_story${NC}"
    fi
}

# Run single iteration
run_iteration() {
    local iteration=$1

    echo -e "${BLUE}--- Iteration $iteration/$MAX_ITERATIONS ---${NC}"
    get_progress_summary
    echo ""

    # Read prompt
    local prompt=$(cat "$PROMPT_FILE")

    # Run opencode
    echo -e "${BLUE}Running opencode...${NC}"
    echo ""

    opencode run -m anthropic/claude-sonnet-4-5 "$prompt"

    echo ""

    # Check completion
    if check_prd_complete; then
        echo -e "${GREEN}PRD complete after $iteration iterations${NC}"
        return 0
    fi

    return 1
}

# Header
display_path() {
    echo "$1" | sed "s|$HOME|~|"
}

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Ralph Agent Loop Runner${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Prompt: ${GREEN}$(display_path "$PROMPT_FILE")${NC}"
echo -e "PRD: ${GREEN}$(display_path "$PRD_FILE")${NC}"
echo -e "Progress: ${GREEN}$(display_path "$PROGRESS_FILE")${NC}"
echo -e "Max iterations: ${YELLOW}$MAX_ITERATIONS${NC}"
echo ""

# Check if already complete
if check_prd_complete; then
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}PRD already complete!${NC}"
    echo -e "${GREEN}================================${NC}"
    exit 0
fi

# Main loop
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))

    if run_iteration $ITERATION; then
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}Success! PRD complete.${NC}"
        echo -e "${GREEN}================================${NC}"

        echo ""
        echo -e "${BLUE}Final Progress:${NC}"
        get_progress_summary

        exit 0
    fi

    if [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo -e "${YELLOW}================================${NC}"
        echo -e "${YELLOW}Warning: Max iterations ($MAX_ITERATIONS) reached${NC}"
        echo -e "${YELLOW}================================${NC}"

        echo ""
        echo -e "${BLUE}Current Progress:${NC}"
        get_progress_summary

        exit 1
    fi

    echo -e "${BLUE}Waiting 2 seconds...${NC}"
    echo ""
    sleep 2
done

echo -e "${RED}================================${NC}"
echo -e "${RED}Failed within $MAX_ITERATIONS iterations${NC}"
echo -e "${RED}================================${NC}"
exit 1
