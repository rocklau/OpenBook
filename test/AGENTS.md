# OpenBook Test Conventions

**Updated:** 2026-02-13  
**Runner:** Node.js native (`node --test`)

## Test Files (current)
```text
test/
├── cli.test.js
├── cli-commands-core.test.js
├── cli-commands-db.test.js
├── collector.integration.test.js
├── date-filter.test.js
├── integration.test.js
├── rss.test.js
└── services.test.js
```

## Verified Practices
- Use temp directories for isolation when tests mutate cwd/files.
- Use real SQLite-backed flows where possible (no heavy mocking of DB behavior).
- CLI has both handler-level tests and argv dispatch tests.
- Integration tests start/stop server programmatically (`startServer(0)`) and use fetch against dynamic localhost port.

## Commands
```bash
npm test
node --test test/cli.test.js
node --test test/integration.test.js
node --test test/collector.integration.test.js
node --test test/services.test.js
```

## Keep In Sync
When adding a command/route/service behavior:
- Add or update focused tests in matching `test/*.test.js`.
- Include success + failure path coverage.
- Keep tests deterministic (no external network dependency unless explicitly controlled by fixture/local server).
