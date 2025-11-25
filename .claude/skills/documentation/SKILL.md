---
name: documentation
description: Centralizes Diataxis documentation framework guidance so Claude can write, review, or improve documentation following the four distinct types (tutorials, how-to guides, reference, explanation).
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# Documentation Skill

Unifies all Diataxis documentation guidance into one Skill. Claude activates this Skill whenever documentation should be written, reviewed, or improved, and then "lazy loads" the exact documentation type guidance by opening the reference docs linked below.

## Critical Workflow

**REQUIRED**: Before writing or reviewing ANY documentation, you MUST load the relevant documentation type reference file(s) using the Read tool. These references contain the specific principles, patterns, and evaluation criteria for each documentation type.

1. Understand the user's documentation need and context (learning, task completion, reference lookup, or understanding).
2. **MANDATORY: Parse documentation type hints** and **READ the matching reference file(s) directly using the Read tool** BEFORE writing/reviewing:
   - Learning experiences Read `references/tutorials.md` FIRST
   - Task-oriented guides Read `references/how-to-guides.md` FIRST
   - Information lookup Read `references/reference.md` FIRST
   - Understanding & context Read `references/explanation.md` FIRST
3. **Apply the documentation type's principles** by following their specific guidance and patterns from the loaded reference.
4. Write or review documentation according to the appropriate type's standards.

**DO NOT attempt to write or review documentation without first loading the appropriate documentation type reference file(s).**

## The Diataxis Framework

The Diataxis framework organizes documentation into four distinct types based on two axes:
- **Vertical Axis**: Action (what users do) vs. Cognition (what users know)
- **Horizontal Axis**: Study (skill acquisition) vs. Work (skill application)

```
              Study                    Work
         _______________________________________________
        |                    |                        |
Action  |    Tutorials       |    How-to Guides      |
        |   (learning)       |      (tasks)          |
        |____________________|_______________________|
        |                    |                        |
Cogni-  |   Explanation      |      Reference        |
 tion    | (understanding)    |    (information)      |
        |____________________|_______________________|
```

## General Checklist

- Identify which documentation type(s) the user needs based on their context and goals.
- Load the appropriate reference file(s) before proceeding.
- Follow the specific principles, language patterns, and structural guidelines for that type.
- Keep documentation types distinct avoid mixing teaching into task guides or instructions into reference.
- Ensure documentation serves its specific purpose effectively.
- Consider the user's context: Are they studying to learn or working to accomplish something?

## Multi-Type Documentation

When multiple documentation types are needed (e.g., "write both a tutorial and reference for this API"):
- Read each relevant reference file from the list below
- Apply each type's principles and patterns separately
- Ensure clear separation between types
- Organize content so users can easily find the type they need

## Documentation Type References (load on demand)

- **Tutorials** - Learning-oriented experiences that enable skill acquisition through guided practice. [Open instructions](references/tutorials.md)
- **How-to Guides** - Task-oriented directions for accomplishing specific goals with actionable steps. [Open instructions](references/how-to-guides.md)
- **Reference** - Information-oriented technical descriptions providing authoritative lookup material. [Open instructions](references/reference.md)
- **Explanation** - Understanding-oriented discussions that provide context, connections, and answer "why?". [Open instructions](references/explanation.md)

Each reference stays out of context until explicitly opened, keeping Claude's context lean while still giving fast access to the detailed documentation guidance.

## Key Principles

1. **Different contexts need different documentation** - Users learning need tutorials; users working need how-to guides or reference; users seeking understanding need explanation.
2. **Separation of concerns** - Keep documentation types distinct to prevent confusion and maintain effectiveness.
3. **User-centered approach** - Consider what the user is trying to accomplish and in what context.
4. **Iterative improvement** - Documentation can be enhanced incrementally by applying Diataxis principles.
5. **Purpose-driven structure** - Each documentation type has specific characteristics that make it effective for its intended purpose.
