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
- **CLI init levels (重要):**
  - Level 0: `help`, `book index --json` → 零副作用，不应触发 feed/OPML I/O
  - Level 1: `recent/search/open/materialize` → 走本地 DB 优先
  - Level 2: `list/read/all/sync` → 才加载 OPML + feeds
- **CLI diagnostics flags:**
  - `--verbose` / `-v`: 输出 feed 来源明细（`network_fetch` / `cache_fallback` / `min_interval_skip` / `memory_cache_hit`）
  - `--quiet`: 隐藏初始化噪音
  - `--json`: 机器可读输出（脚本友好）
- **Web observability env:**
  - `OPENBOOK_WEB_VERBOSE=true`：开启 API/业务结构化日志
  - `OPENBOOK_SYNC_VERBOSE=true`：开启 sync/feed 详细日志
  - 启动后会输出 `[Observability] OPENBOOK_WEB_VERBOSE=...`
- **Trace correlation (local-first 核心):**
  - 前端请求自动带 `x-openbook-trace-id` + `x-openbook-action-id`
  - 服务端日志包含 `requestId/traceId/actionId`，可按 trace 快速串联完整用户操作
- **Key debug endpoints:**
  - `GET /api/sync/status`：同步状态
  - `POST /api/sync/warm`：可传 `verbose=true` 看抓取来源统计
  - `GET /api/debug/recent-events?limit=100`：最近事件缓冲（快速回放）
- **UI integrated test shortcut (Actionbook):**
  - 覆盖主链路：Reader 选文 → Favorite → Note 保存 → Activity 打开 → Notes 加载分页
  - 用日志核对 API 调用顺序与 `trace/action` 是否一致
- **Common pitfalls to avoid:**
  - `EADDRINUSE`：重复起服务前先清理旧进程/端口
  - 不要只看 UI 结果；需要同时核对 `activity_log` 与服务端 observability 日志
  - `materialize` 是幂等的，重复操作出现 `already_materialized` 属于预期
