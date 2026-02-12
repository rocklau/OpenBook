# OpenBook Test Conventions

**Generated:** 2026-02-12  
**Runner:** Node.js native (`node:test`)

## OVERVIEW
Tests use Node's native test runner with real fixtures, not mocks. CLI tests run against temp SQLite databases; integration tests hit `localhost:3000`.

## STRUCTURE
```
test/
├── cli.test.js         # CLI command handlers (unit-ish)
├── integration.test.js # API endpoint integration tests
├── rss.test.js         # RSS parser tests
└── date-filter.test.js # Date utility tests
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add CLI test | `cli.test.js` | Use `withCapturedLogs()` + temp dir pattern |
| Add API test | `integration.test.js` | Requires running server on :3000 |
| RSS parsing test | `rss.test.js` | OPML fixtures in `test/fixtures/` |
| Date logic test | `date-filter.test.js` | Date boundary edge cases |

## CONVENTIONS
- **Temp directories:** Use `fs.mkdtempSync()` + `process.chdir()` for isolation
- **Real databases:** Tests create actual SQLite files, not mocks
- **Console capture:** `withCapturedLogs()` helper for output assertions
- **OPML fixtures:** Lightweight XML files to avoid network dependencies
- **Entry guard:** `require.main === module` prevents side effects when imported

## ANTI-PATTERNS
- **DON'T mock SQLite:** Use temp DBs with real schema
- **DON'T test argv parsing:** Test command handlers directly
- **DON'T share state:** Each test gets fresh temp directory
- **NEVER test against production DB:** Tests use `OPENBOOK_DATA_DIR` override

## TEST PATTERNS
```javascript
// CLI test pattern
const { describe, it, beforeEach, afterEach } = require('node:test');

let tmpDir, oldCwd;
beforeEach(() => {
  oldCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbook-test-'));
  process.chdir(tmpDir);
});
afterEach(() => {
  process.chdir(oldCwd);
  fs.rmSync(tmpDir, { recursive: true });
});
```

## COMMANDS
```bash
npm test                    # Run all tests
node --test test/cli.test.js     # CLI tests only
node --test test/integration.test.js  # Integration tests only
```

## NOTES
- Integration tests require server running (`npm start` first)
- Tests use lightweight OPML fixtures to avoid flaky network calls
- Activity log tests query `payload_json` with JSON semantics
