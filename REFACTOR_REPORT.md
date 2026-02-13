# OpenBook Refactor Report

Date: 2026-02-13

## Summary
This refactor focused on making article collection idempotent and reducing duplicate work across the materialization pipeline.

Key outcomes:
- Article-level idempotency was added: the same article URL is materialized only once.
- Collector logic was simplified and split into focused helpers.
- Resource collection avoids duplicate downloads both within a run and across reruns.
- Logging now clearly shows when an article is skipped.
- Integration and service tests were added/updated to verify behavior.

## What Changed

### 1) Article-level idempotency in materialization
**File:** `services/articleService.js`

- `materializeArticle()` now checks for an existing article by normalized URL before fetching HTML.
- If an existing record has a valid `markdown_path` file, the method returns early:
  - `ok: true`
  - `skipped: true`
  - `reason: "already_materialized"`
  - existing `articleId` and `markdownPath`
- Added explicit skip log:
  - `[Materialize] Skipped already materialized article: <id> (<url>)`

This prevents the entire pipeline from running a second time for the same article URL.

### 2) Repository support for URL lookup
**File:** `repositories/index.js`

- Added query and repository API:
  - `getArticleByLink(link)`

This enables the materialization pre-check without adding hot-path joins.

### 3) Collector refactor for clarity and dedupe
**File:** `collector.js`

Refactored into smaller helpers:
- `parseSourceUrlFromFrontmatter`
- `isAlreadyCollected`
- `resolveResourceUrl`
- `pickExtension`
- `ensureLocalAsset`
- `collectImageMatches`

Behavior improvements:
- Dedupes by resolved absolute resource URL in a single run.
- Reuses existing asset files by URL hash across reruns.
- Rewrites markdown to local asset paths only when needed.
- Adds skip logging when nothing is collectable:
  - `[Collector] Skipped article <articleId>: no collectable images (...)`
- Adds reuse logging for existing assets.

## Test Coverage Added/Updated

### New integration test
**File:** `test/collector.integration.test.js`

Validates:
- Duplicate image references (relative + absolute + repeated absolute) are downloaded once.
- Markdown is rewritten to local asset paths.
- Re-running collector does not re-download assets.

### New service test
**File:** `test/services.test.js`

Added:
- `articleService.materializeArticle should skip when url already materialized`

Validates:
- Materialization is skipped when markdown already exists for the URL.
- Network fetch is not executed in this path.

## Verification

Commands executed:
- `node --test test/collector.integration.test.js`
- `node --test test/services.test.js`
- `npm test --silent`

Result:
- All tests passing (`40 passed, 0 failed`).

## Notes
- This update enforces idempotency at the article level, not only at image collection level.
- The current behavior treats different URLs as different articles, even if content is similar.
- If needed later, canonical URL normalization rules can be expanded (e.g., query param stripping policy).
