# WODsmith Documentation

This is the documentation website for WODsmith, built using [Docusaurus 3](https://docusaurus.io/).

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter wodsmith-docs dev
```

Or from this directory:

```bash
pnpm dev
```

The development server runs at http://localhost:3000 with hot reloading.

## Building

```bash
pnpm build
```

This generates static content into the `build` directory.

## Deployment

The docs site is deployed to Cloudflare Pages at `docs.wodsmith.com`.

### Manual Deploy

```bash
pnpm deploy
```

### CI/CD

Deployments are automated via GitHub Actions when changes are pushed to the main branch.

## Documentation Structure

```
docs/
├── intro.md                 # Homepage
├── getting-started/         # Onboarding guides
│   ├── quick-start.md
│   └── concepts.md
├── features/                # Feature documentation
│   ├── workouts.md
│   ├── programming.md
│   ├── teams.md
│   └── competitions.md
└── guides/                  # How-to guides
    ├── creating-workouts.md
    └── managing-teams.md
```

## Adding Documentation

1. Create a new `.md` file in the appropriate directory
2. Add frontmatter with `sidebar_position` for ordering
3. The sidebar is auto-generated from the file structure

## Configuration

- `docusaurus.config.ts` - Main configuration
- `sidebars.ts` - Sidebar configuration
- `src/css/custom.css` - Custom styles
