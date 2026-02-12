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
