# AGENTS.md - Coding Guidelines for WodSmith

## Build/Test/Lint Commands
- **Dev**: `pnpm dev`
- **Build**: `pnpm build` (local) or `pnpm build:prod` (production)
- **Lint**: `pnpm lint` (uses Biome)
- **Format**: `pnpm format` (auto-fix with Biome)
- **Type Check**: `pnpm type-check` or `pnpm type-check:changed`
- **Test All**: `pnpm test`
- **Test Single**: `pnpm test path/to/test.test.ts`
- **DB Migrations**: `pnpm db:migrate:dev` (local) or `pnpm db:migrate:prod`

## Code Style & Conventions
- **Package Manager**: Always use `pnpm` (never npm/yarn)
- **Formatting**: Tabs for indentation, double quotes for strings, semicolons as needed (Biome enforced)
- **Imports**: Use `@/` alias for src imports (e.g., `import { utils } from "@/lib/utils"`)
- **Components**: React components in PascalCase, files in kebab-case
- **Git Commits**: Use semantic prefixes: `fix:`, `feat:`, `chore:` (enforced by pre-commit hooks)
- **Testing**: Tests run in single-run mode with fail-fast. Place tests in `test/` directory
- **TypeScript**: Strict mode enabled, use explicit types for function params and returns
- **React**: Memoize callbacks in useEffect deps or use empty array for mount-only effects
- **Error Handling**: Use try-catch blocks with proper error logging
- **No Comments**: Do not add code comments unless explicitly requested