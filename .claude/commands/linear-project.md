---
description: Work on a Linear project with structured workflow
args:
  - name: PROJECT_NAME
    description: The name or ID of the Linear project to work on
    required: true
---

# Linear Project Management

You are working on the Linear project: {{PROJECT_NAME}}

## Workflow Instructions

### 1. Getting Started
When starting work on this project:
1. Use the project-manager-linear agent to get the current project status and identify the next task to work on
2. Review completed issues to understand what's been done
3. Identify the next logical issue based on dependencies and priority
4. Get full details including acceptance criteria for the selected issue

### 2. Working on Issues
- Create a todo list using TodoWrite to track progress through each issue
- Follow the acceptance criteria exactly as specified in Linear
- Make incremental commits as you complete major parts of the work
- Keep the todo list updated as you progress

### 3. Committing Work
When committing changes:
- **ALWAYS commit your work** using the format:
  ```
  feat(module): ISSUE-ID brief description

  - Bullet point of what was implemented
  - Another change made
  - Any important notes
  ```
- Make frequent, small commits rather than large ones
- Include the Linear issue ID (e.g., WOD-56) in commit messages
- Run lint and type checks before committing

### 4. Linear Integration
- Use the project-manager-linear agent to:
  - Update issue status when starting/completing work
  - Add comments to issues with implementation details
  - Check for any new requirements or changes
  - Create new issues if needed following Linear guidelines

### 5. Continuing Work
When asked to "continue on" or pick up the next task:
1. Commit any pending work first
2. Use the project-manager-linear agent to identify the next issue
3. Get full details for the new issue
4. Create a fresh todo list for the new task
5. Begin implementation

## Important Reminders
- Always use the existing codebase patterns and libraries (e.g., pragmatic-drag-and-drop, not dnd-kit)
- Follow the project's existing conventions found in CLAUDE.md
- Test your changes before marking issues as complete
- Keep Linear issues updated with your progress

## Agent Usage
Remember to use these agents proactively:
- `project-manager-linear` - For all Linear project management tasks
- `general-purpose` - For complex research or multi-step tasks
- `gemini-assistant` - For deep codebase analysis when needed

## Current Project Context
Project: {{PROJECT_NAME}}
Description: Use the project-manager-linear agent to get the current status and recent activity on this project.