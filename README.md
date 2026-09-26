# my-upwork

Original portfolio collection containing eight differentiated web-product demos in one statically exportable Next.js application.

## Products
- ChainPulse — crypto growth agency
- OrbitOps — AI automation agency
- MetricFlow — B2B SaaS
- Maison Estate — luxury real estate
- NOMA Coffee — cafe / restaurant
- AURA — DTC ecommerce
- Northstar — creative/development agency
- LedgerX UI — fintech dashboard concept

## Requirements
- Node.js 24 LTS
- pnpm 12

## Local development
```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Quality verification
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The production build uses Next.js static export and writes deployable output to `out/`.

## Routes
- `/` — portfolio hub
- `/work/chainpulse`
- `/work/orbitops`
- `/work/metricflow`
- `/work/maison-estate`
- `/work/noma-coffee`
- `/work/aura-commerce`
- `/work/northstar-studio`
- `/work/ledgerx-ui`

## Data policy
The portfolio uses deterministic mock content only. There is no database, authentication, real payment execution, or storage of user personal data.

## Design
See `DESIGN.md`, `PRODUCT.md`, `ARCHITECTURE.md` and the Phase 4–8 documents for product and implementation decisions.
