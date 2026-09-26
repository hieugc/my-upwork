# Architecture

## Phase 3 — Stack
- Next.js 16 Active LTS line
- React 19.3
- TypeScript strict
- Node.js 24 LTS
- pnpm 12 workspace
- Tailwind CSS 4.3
- React Server Components by default
- Client Components only for interaction islands
- Playwright for browser/E2E verification
- Vitest for unit/component logic where needed

## Repository
```
my-upwork/
  apps/
    portfolio-hub/
    chainpulse/
    orbitops/
    metricflow/
    maison-estate/
    noma-coffee/
    aura-commerce/
    northstar-studio/
    ledgerx-ui/
  packages/
    a11y/
    eslint-config/
    tsconfig/
    test-utils/
  mockups/
  docs/
```

## Rendering
Marketing-heavy apps: static generation / server rendering.
Interactive dashboard demos: server shell + client interaction islands.
No app requires a persistent database for the portfolio MVP.

## Data
Seeded typed fixtures live inside each app. Public demos must not collect sensitive data. Contact forms use a demo-safe success flow unless a real provider is configured later.

## Isolation
Every app has its own:
- theme/tokens
- content model
- metadata
- component layer
- route tree
Shared packages are infrastructure only, not visual cloning.

## Deployment
Each app can be deployed independently from the monorepo using its app directory as project root.
