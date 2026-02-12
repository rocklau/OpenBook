# Contributing to OpenBook

Thanks for your interest in contributing to OpenBook.
This document explains how to set up the project, submit changes, and maintain README screenshots consistently.

## Development Setup

```bash
npm install
npm start
```

Open the app at `http://localhost:3000`.

## Run Tests

```bash
npm test
node --test test/cli.test.js          # CLI tests (function + argv dispatch)
node --test test/rss.test.js          # RSS parser tests
node --test test/date-filter.test.js  # Date filter tests
node --test test/integration.test.js  # Integration tests
```

### CLI testing conventions (important)

When changing `cli.js`, keep tests aligned with real behavior:

- Prefer **real handler tests** over mock self-validation.
- Use temp SQLite fixtures and assert query behavior against `activity_log.payload_json`.
- Add at least one **argv dispatch test** (`spawnSync('node', ['cli.js', ...])`) for new commands.
- Validate both success and failure paths (missing DB, invalid args, empty query, etc.).
- Keep tests deterministic: isolated temp cwd and local fixture files.

## Branch, Commit, PR Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b <type>/<short-name>
   ```
2. Keep commits focused and atomic.
3. Use clear commit messages, e.g.:
   - `feat: ...`
   - `fix: ...`
   - `docs: ...`
4. Push branch and open a PR.
5. Prefer squash merge for docs/small feature PRs.

## Coding Guidelines

- Preserve the existing UI architecture (state-driven body classes, responsive layout separation).
- Avoid mixing unrelated refactors in one PR.
- Keep API/documentation updates in sync when behavior changes.

## Screenshot Contribution Guide (Actionbook)

When updating README screenshots, follow this process:

1. Start local app:
   ```bash
   npm start
   ```
2. Run Actionbook manual search first:
   ```bash
   actionbook search "openbook screenshot" --url http://localhost:3000
   ```
3. For localhost pages, if no manual exists, use fallback:
   - `actionbook browser snapshot`
   - then use `actionbook browser click/fill/eval` based on current page output
4. Capture required screenshots.
5. Close browser session:
   ```bash
   actionbook browser close
   ```

### Required README screenshots

- Desktop:
  - `reader_interface.png`
  - `notes_interface.png`
- Mobile:
  - `mobile_feeds.png`
  - `mobile_reader.png`
  - `mobile_reader_detail.png`
  - `mobile_notes.png`

### Actionbook lessons learned

- Always run `actionbook search` first (Actionbook best practice).
- SPA state changes may not trigger full navigation; `wait-nav` can timeout.
- On mobile, explicitly switch state before each screenshot to avoid duplicate images.
- In this project, these functions are reliable for deterministic mobile states:
  - `toggleMobileSidebar(true)`
  - `closeMobileSidebar()`
  - `switchToReaderView()`
  - `switchToNotesView()`

### Proven command recipes (from real project runs)

These are command patterns that worked reliably in this repo.

#### A) Desktop: open browser → switch tabs/views → screenshot

```bash
# 1) Open local app
actionbook browser open "http://localhost:3000"

# 2) Snapshot current accessible tree (fallback when no manual exists)
actionbook browser snapshot

# 3) Capture Reader (desktop default)
actionbook browser screenshot reader_interface.png

# 4) Switch to Notes (deterministic in this codebase)
actionbook browser eval "(() => { const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Notes'); if(btn){btn.click(); return 'clicked-notes';} return 'notes-button-not-found'; })()"

# 5) Capture Notes
actionbook browser screenshot notes_interface.png
```

#### B) Mobile: force mobile viewport context, then capture each state

For stable mobile capture, we used a dedicated Chrome instance and connected Actionbook to it:

```bash
# 1) Start Chrome with mobile-sized window and CDP port
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9333 \
  --user-data-dir=/tmp/openbook-mobile-chrome \
  --window-size=390,844 \
  "http://localhost:3000"

# 2) Connect Actionbook to that browser
actionbook browser connect 9333

# 3) Verify page structure in current session
actionbook browser snapshot

# 4) Capture Feeds
actionbook browser eval "switchToReaderView(); toggleMobileSidebar(true); 'mobile-feeds-open'"
actionbook browser screenshot mobile_feeds.png

# 5) Capture Reader list
actionbook browser eval "closeMobileSidebar(); switchToReaderView(); 'mobile-reader-list'"
actionbook browser screenshot mobile_reader.png

# 6) Capture Reader detail (open first article)
actionbook browser eval "switchToReaderView(); closeMobileSidebar(); const first=document.querySelector('.article-item'); if(first){ first.click(); 'opened-first-article'; } else { 'no-article-item'; }"
actionbook browser screenshot mobile_reader_detail.png

# 7) Capture Notes
actionbook browser eval "switchToNotesView(); closeMobileSidebar(); 'mobile-notes'"
actionbook browser screenshot mobile_notes.png
```

#### C) Cleanup (important)

```bash
actionbook browser close
# if you launched dedicated mobile Chrome:
pkill -f "remote-debugging-port=9333" || true
```

#### D) Quick troubleshooting

- If `wait-nav` times out on SPA transitions, switch to `snapshot` + explicit state eval.
- If mobile screenshots look identical, you likely did not change view state before capture.
- If CDP connect fails, make sure the debug port process is running (`lsof -i :9333`).

## What to Include in a Good PR

- Clear summary of what changed and why.
- Screenshots for UI changes (desktop/mobile where relevant).
- Notes on testing performed.
- Any migration or compatibility impact.

## Housekeeping

- Do not commit local temp/debug artifacts.
- `.entire/` is intentionally ignored.

---

If you are unsure about scope or implementation direction, open a draft PR early and ask for feedback.
