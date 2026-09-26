# Phase 8 — CI/CD and Monitoring

## Pull request checks
1. pnpm install --frozen-lockfile
2. pnpm lint
3. pnpm typecheck
4. pnpm test
5. pnpm build

## Browser verification
Playwright smoke coverage per app:
- home route loads
- desktop navigation
- mobile navigation
- primary CTA
- one key interaction
- no uncaught page errors

## Deployment
- preview deployment per pull request when provider integration is enabled
- production deploy from main after CI passes
- independent deployment roots for each app

## Monitoring
For portfolio MVP:
- provider deployment status
- lightweight web analytics only if enabled
- no session replay by default
- no collection of sensitive form data

## Security
- Dependabot enabled
- no secrets committed
- CSP/security headers where compatible
- external links use safe rel attributes
- simulated finance/payment functions clearly labeled

