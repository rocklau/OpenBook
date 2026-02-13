# OpenBook Knowledge Base

**Updated:** 2026-02-13  
**Stack:** Node.js, Express, SQLite, Vanilla JS

## Overview
OpenBook is a local-first RSS reader + knowledge collector.

Core runtime behavior verified in code:
- Web app is created in `app.js` and started by `server.js`.
- API routes are split into `routes/articles.js`, `routes/activity.js`, and `routes/debug.js`.
- Business logic is in `services/articleService.js` and `services/activityService.js`.
- DB access is centralized in `repositories/index.js`.
- SQLite schema/storage helpers are in `storage.js`.
- RSS ingestion/parsing is in `rss.js`.

## Deviations from Standard Node.js/Express Layout
- **Dual entrypoints**: `server.js` (starts HTTP server) + `app.js` (creates Express context). Standard is single entry (e.g., index.js or bin/www).
- **No src/ directory**: All modules at root level.
- **CLI split**: Root `cli.js` + `cli/` subdirectory. Standard: bin/ script + lib/cli module.
- **Naming collision risk**: `public/app.js` (frontend) vs `app.js` (server).

## Current Structure
```text
./
├── server.js
├── app.js
├── routes/
│   ├── articles.js
│   ├── activity.js
│   └── debug.js
├── services/
│   ├── articleService.js
│   └── activityService.js
├── repositories/
│   └── index.js
├── cli.js
├── cli/
├── rss.js
├── storage.js
├── collector.js
├── public/
├── test/
└── data/
```

## Where To Change Things
- Add/modify API endpoint: `routes/*.js`
- Update materialization/state logic: `services/articleService.js`
- Update activity/export logic: `services/activityService.js`
- Update SQL queries/repository methods: `repositories/index.js`
- Update CLI behavior/dispatch: `cli.js` and `cli/*.js`
- Update schema/storage paths: `storage.js`

## Verified Conventions
- Article ID generation uses `stableId(feedUrl, guid|link|title)` in `app.js` (`processArticles`) and `services/articleService.js` (`materializeArticle`).
- Materialization is idempotent by normalized URL in `services/articleService.js`.
- Collector deduplicates resources and rewrites markdown to local assets in `collector.js`.
- UI is static-served from `public/`; no frontend build step exists.

## Project-Specific Rules
- **No ESLint/.editorconfig**: Project has no root-level linting or formatting config. All ESLint configs found are in node_modules/dependencies.
- **No CI workflows**: No `.github/workflows` or Makefile at root.
- **Node.js native test runner**: Uses `node --test` with describe/it blocks, not Jest/Mocha.

## Anti-Patterns (Explicitly Forbidden)
- No explicit DO NOT/NEVER/ALWAYS comments found in codebase.
- Follows existing patterns in `services/` and `repositories/` for new code.

## Commands
```bash
npm start
npm test
node cli.js
node cli.js help
node cli.js book index --json
```

## Observability / Debug
- `OPENBOOK_WEB_VERBOSE=true` enables structured request/business logging.
- `OPENBOOK_SYNC_VERBOSE=true` enables sync/feed detail logging.
- `GET /api/sync/status`
- `POST /api/sync/warm`
- `GET /api/debug/recent-events?limit=100`

## Notes
- `scripts/trace-grep.sh <traceId> [logFile]` exists for trace filtering.
- Default trace log target in script/docs is `/tmp/openbook.log`.
