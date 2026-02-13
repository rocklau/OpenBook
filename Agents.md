# OpenBook Knowledge Base

**Generated:** 2026-02-12  
**Stack:** Node.js, Express, SQLite, Vanilla JS  
**Type:** Indie RSS reader + knowledge collector

## OVERVIEW
OpenBook is a local-first RSS reader with unified Reader/Notes UI. It materializes articles as Markdown, captures highlights/notes, and exports knowledge for Obsidian/LLM workflows.

## STRUCTURE
```
./
├── server.js          # Express API + static serving
├── cli.js             # CLI interface (list, read, search, export)
├── rss.js             # RSS parsing + OPML import
├── storage.js         # SQLite schema + JSON index helpers
├── activity.js        # Activity type constants
├── collector.js       # Asset download for favorited articles
├── html_to_md.js      # HTML→Markdown conversion (Turndown)
├── public/
│   └── index.html     # Single-page UI (state-driven)
├── test/              # Node.js native test runner
└── data/              # SQLite, Markdown articles, notes
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add API endpoint | `server.js` | Express routes, SQLite prepared statements |
| Modify CLI command | `cli.js` | Command dispatch in `main()` switch |
| Change RSS parsing | `rss.js` | `RSSReader` class, feed caching |
| Update DB schema | `storage.js` | `migrate()` function |
| Frontend UI changes | `public/index.html` | CSS vars + vanilla JS, no build step |
| Add test | `test/*.test.js` | Node native test runner |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `RSSReader` | Class | `rss.js` | Feed parsing, caching |
| `openDb()` | Function | `storage.js` | SQLite connection |
| `processArticles()` | Function | `server.js:70` | DB upsert + state attach |
| `stmtLogActivity` | Prepared | `server.js:56` | Activity feed writes |
| `ACTIVITY_TYPES` | Constants | `activity.js` | 'state', 'note', 'materialize' |

## CONVENTIONS
- **IDs:** Stable hash `md5(feed_url + guid\|link)` via `utils.stableId()`
- **File naming:** `safeFileName()` → lowercase, alphanumeric + hyphen
- **Dates:** ISO 8601 strings, SQLite `datetime('now')`
- **Async:** Prefer `better-sqlite3` synchronous API; `async/await` for I/O
- **No build step:** Frontend is vanilla JS in single HTML file
- **No linting config:** No ESLint/Prettier configs present

## ANTI-PATTERNS
- **NEVER use `AS any` or `@ts-ignore`:** Not applicable (plain JS)
- **DON'T break mobile state exclusivity:** CSS classes must be mutually exclusive
- **NEVER trust selection coordinates alone:** Always use `getBoundingClientRect() + scrollY`
- **DON'T query activity_log with joins in hot paths:** Payload stored denormalized

## UNIQUE PATTERNS
- **State-driven layout:** `document.body.className` controls view state (not React/Vue)
- **Paper aesthetic:** Warm palette (`#f8f5f0`), Georgia serif, soft shadows
- **Dual storage:** SQLite for queries + JSON index for grep-friendly access
- **Activity log:** Append-only audit trail for all user actions

## COMMANDS
```bash
npm start              # Web server @ localhost:3000
npm test               # Run all tests (Node native runner)
node cli.js            # Default: show recent articles
node cli.js search "AI" # Search by keyword
node cli.js export 7   # Export last 7 days as Markdown
```

## NOTES
- **Mobile breakpoint:** 768px switches from grid to stacked views
- **Grid reset:** Mobile uses `!important` to override desktop grid-column spans
- **WAL mode:** SQLite runs with `journal_mode = WAL` for concurrency
- **No migrations table:** Schema version not tracked; manual migration only
- **OPML loading:** All `.opml` files in root loaded at startup

## DEBUG & EXECUTION PLAYBOOK (for faster, low-error operations)
- **CLI init levels (important):**
  - Level 0: `help`, `book index --json` → zero side effects; should not trigger feed/OPML I/O
  - Level 1: `recent/search/open/materialize` → prioritize local DB access
  - Level 2: `list/read/all/sync` → only then load OPML + feeds
- **CLI diagnostics flags:**
  - `--verbose` / `-v`: print feed source details (`network_fetch` / `cache_fallback` / `min_interval_skip` / `memory_cache_hit`)
  - `--quiet`: hide initialization noise
  - `--json`: machine-readable output (script-friendly)
- **Web observability env:**
  - `OPENBOOK_WEB_VERBOSE=true`: enable structured API/business logs
  - `OPENBOOK_SYNC_VERBOSE=true`: enable detailed sync/feed logs
  - On startup, `[Observability] OPENBOOK_WEB_VERBOSE=...` will be printed
- **Trace correlation (local-first core):**
  - Frontend requests automatically include `x-openbook-trace-id` + `x-openbook-action-id`
  - Server logs include `requestId/traceId/actionId` to quickly stitch together a full user action chain by trace
- **Key debug endpoints:**
  - `GET /api/sync/status`: sync status
  - `POST /api/sync/warm`: pass `verbose=true` to inspect fetch source stats
  - `GET /api/debug/recent-events?limit=100`: recent event buffer (quick replay)
- **UI integrated test shortcut (Actionbook):**
  - Cover the main flow: Reader select article → Favorite → save Note → open Activity → load Notes pagination
  - Use logs to verify API call order and consistency of `trace/action`
- **Common pitfalls to avoid:**
  - `EADDRINUSE`: clear old process/port usage before restarting the server
  - Do not rely on UI results alone; also verify `activity_log` and server observability logs
  - `materialize` is idempotent; repeated operations returning `already_materialized` are expected
- **Trace helper script:**
  - `scripts/trace-grep.sh <traceId> [logFile]`
  - Default log file is `/tmp/openbook.log`, used to quickly filter a full API trace chain for one session
