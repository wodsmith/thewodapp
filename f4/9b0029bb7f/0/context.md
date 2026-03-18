# Session Context

## User Prompts

### Prompt 1

I have two tasks I want you to accomplish. The first is a data one. we have this @apps/wodsmith-start/src/components/registration/affiliate-combobox.tsx @apps/wodsmith-start/src/server-fns/affiliate-fns.ts#L48-70  that searches for affiliates but right now it only displays 'verified' affiliates. we want to open search up to any affiliates others have answered that aren't just verified so that if someone entered their gym, others can select that option after searching so we don't have a crazy num...

### Prompt 2

the search doesn't seem to really do anything when you're typing and it doesn't hit.. feels broken

### Prompt 3

why do verified results ALWAYS show up I hate it

### Prompt 4

why are non verified affiliates not showing up?

### Prompt 5

I thought when I selected an affiliate it would seed, do I need to actually complete the registration first?

### Prompt 6

nah lets wait

### Prompt 7

## Context

- Current branch: zac/fix-affiliate-picker
- Git status:  M apps/wodsmith-start/src/db/index.ts
- Uncommitted changes: diff --git a/apps/wodsmith-start/src/db/index.ts b/apps/wodsmith-start/src/db/index.ts
index fef59703..d9df3b4c 100644
--- a/apps/wodsmith-start/src/db/index.ts
+++ b/apps/wodsmith-start/src/db/index.ts
@@ -35,24 +35,24 @@ export type Database = MySql2Database<typeof schema>
  * connection pooling externally at the Cloudflare level.
  */
 export const getDb = createS...

### Prompt 8

pull pr comments and address them

