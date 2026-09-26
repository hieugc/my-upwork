# Phase 7 — Hosting & Cost

Checked 2026-09-26.

## Default
Cloudflare Pages for static-heavy portfolio demos when suitable.
- Static asset requests: free and unlimited.
- Free Workers/Pages Functions quota: 100,000 requests/day shared with Workers usage.

## Alternative
Vercel
- Hobby: $0/month, suitable for personal projects.
- Pro: $20/month and includes $20 usage credit.
- Hobby currently has 10 GB deployment storage with reduced old-deployment retention.

## CI
GitHub Free:
- unlimited public/private repositories;
- 2,000 Actions minutes/month for private repositories;
- standard Actions use on public repositories remains free.

## Recommendation for this portfolio
Keep repository public if acceptable, use GitHub Actions for CI, deploy each demo independently. Prefer Cloudflare Pages for static demos and Vercel for apps where Next.js platform integration materially simplifies deployment.

## Cost target
$0/month for initial public portfolio, excluding optional domain registration.
