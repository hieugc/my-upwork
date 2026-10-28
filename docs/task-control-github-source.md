# Local Task Control — GitHub source synchronization

Task Control UI has been versioned from the canonical local
`infrastructure/workspace-control-center/modules/task-control`
into this existing portfolio repository without deleting its product demos.

**Source delivered only:** no backend port, production Task Control process,
Gateway :8090 or PostgreSQL state was modified by the GitHub coding batch.
See CRM #19 (source coding) and CRM #20 (runtime cutover / acceptance).

## Build and start on an approved Mac

```sh
pnpm install --frozen-lockfile
# Preserves static portfolio behavior:
pnpm build
# Separately build the actual server-backed Task Control runtime:
pnpm build:task-control
pnpm start:task-control
# Check http://127.0.0.1:3000/task-control
```

Static portfolio build is the default (Next output export, no Gateway proxy).
`build:task-control` uses `STATIC_EXPORT=0`, a separate
`.next-task-runtime` output and only fixed loopback Gateway proxies:
`/mcp-admin/* -> 127.0.0.1:8090/api/admin/*`,
`/mcp-workflows/* -> 127.0.0.1:8090/api/workflows/*`.
An isolated QA Gateway port can be supplied via the numeric
`TASK_CONTROL_QA_GATEWAY_PORT` variable. The Next start command
binds `127.0.0.1:3000`, not a public interface.

All API writes remain subject to the existing Gateway bearer credentials,
operator approvals and task/file/issue receiver fencing. UI-side labels and
GitHub comments do **not** certify quality acceptance.

### Important limitations

- Local protected Playwright operations service (`ops-console`) is not
  migrated by this UI source sync; that separate local service must be
  configured independently before Playwright UI actions can work.
- Live Gateway, browser hydration, 21-project count, rollback, process
  supervision and production deployment remain operator-run QA gates.
- Static-export output has no live API proxy, so Task Control won't operate
  as a live dashboard on GitHub Pages.
- Do not start a second listener while :3000 is owned by another app.
  Use the reviewed safe supervision/runbook in `hieugc/mcp-servers` PR #39
  only after validating the actual workspace and owner.
