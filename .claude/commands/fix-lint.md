# /fix-lint

Automatically fix all lint errors in the codebase by first running the linter with auto-fix, then manually addressing any remaining issues.

## Steps

1. Run `pnpm lint --write` to automatically fix any fixable lint errors
2. Analyze remaining errors that couldn't be auto-fixed
3. Fix each remaining error manually
4. Run `pnpm lint` again to verify all errors are resolved
5. Provide a summary report of:
   - Number of errors auto-fixed
   - Number of errors manually fixed
   - List of files modified
   - Any remaining warnings (if applicable)

## Expected Behavior

- The command should fix all lint errors (not just warnings)
- It should preserve code functionality while fixing style/syntax issues
- For array index key warnings, use stable unique identifiers instead of indices
- For type errors, properly type variables instead of using `any`
- Import unused variables/imports should be removed or properly used

## Success Criteria

- `pnpm lint` should report 0 errors after completion
- All fixes should maintain existing functionality
- Code should follow the project's linting standards (Biome)