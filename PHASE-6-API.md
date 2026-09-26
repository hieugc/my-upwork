# Phase 6 — API Contract

## MVP
No external API is required. Interactive flows use app-local service abstractions and deterministic fixtures.

## Route-handler contract
POST /api/contact
Request: { name, email, company?, message }
Response: { ok: true, referenceId }

POST /api/demo/booking
Request: { name, email, date, slot, notes? }
Response: { ok: true, bookingId, status: "demo-confirmed" }

POST /api/demo/cart/quote
Request: { items: [{ productId, variantId?, quantity }] }
Response: { subtotal, discounts, taxDemo, total }

POST /api/demo/roi
Request: { monthlyHours, hourlyCost, automationPercent }
Response: { estimatedMonthlySavings, estimatedAnnualSavings }

## Rules
- validate all request bodies;
- rate-limit if deployed with public write endpoints;
- do not store personal information in portfolio mode;
- no payment execution;
- LedgerX trading controls are simulation-only.

## Sequence
Browser -> Next.js Route Handler -> validation -> deterministic demo service -> typed response -> UI feedback.
