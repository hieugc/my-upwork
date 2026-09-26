# Phase 5 — Data Architecture

## Decision
The portfolio MVP has no persistent database.

Reason:
- all products are public demonstration sites;
- seeded deterministic data makes demos reproducible;
- no authentication or real user accounts are required;
- no sensitive information needs persistence.

## Typed fixture domains
- ChainPulse: services, campaigns, caseStudies, insights
- OrbitOps: workflows, integrations, automations, roiScenarios
- MetricFlow: metrics, features, plans, integrations
- Maison Estate: properties, agents, neighborhoods
- NOMA Coffee: menuItems, modifiers, locations, bookingsDemo
- AURA Commerce: products, variants, collections, reviewsDemo
- Northstar Studio: projects, capabilities, team
- LedgerX UI: assets, positions, transactions, watchlist

## Persistence upgrade path
If a future client version needs persistence, isolate repositories behind app-specific data adapters and introduce PostgreSQL without changing presentation components.
