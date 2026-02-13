# Changelog

All notable changes to this project are documented in this file.

## 2026-02-13

### Fixed
- Enforced **article-level idempotency** for materialization in `services/articleService.js`:
  - Skip full materialization when the same normalized URL already has an existing markdown file.
  - Return `skipped: true` with reason `already_materialized`.
  - Added log: `[Materialize] Skipped already materialized article: ...`.

- Prevented **concurrent duplicate materialization** for the same URL:
  - Added in-flight dedupe map keyed by normalized URL.
  - Concurrent calls now join the same promise instead of running duplicate fetch/write flows.
  - Added log: `[Materialize] Joined in-flight materialization: ...`.

- Prevented repeated favorite/state side effects:
  - `updateArticleState` now serializes updates per article ID and short-circuits when state is unchanged (`state_unchanged`).
  - Avoids duplicate state activity entries and duplicate collector triggers from rapid repeated requests.

- Improved repository lookup accuracy for idempotency checks in `repositories/index.js`:
  - `getArticleByLink()` now prioritizes rows with non-null `markdown_path`:
    - `ORDER BY (markdown_path IS NOT NULL) DESC, updated_at DESC`.
  - Fixes edge cases where an older row for the same link could bypass skip logic.

- Updated `/api/article/state` route to async handling (`routes/articles.js`) to correctly await serialized state updates.

### Refactored
- Simplified and modularized collector logic in `collector.js` with focused helpers:
  - `parseSourceUrlFromFrontmatter`
  - `isAlreadyCollected`
  - `resolveResourceUrl`
  - `pickExtension`
  - `ensureLocalAsset`
  - `collectImageMatches`

- Resource dedupe improvements in collector:
  - Dedupe by resolved absolute resource URL in a run.
  - Reuse existing local assets by stable URL hash across reruns.
  - Rewrite markdown only when necessary.

### Logging
- Added explicit skip/reuse logs for easier production verification:
  - Collector skip summary: `no collectable images (total/localized/unresolved)`.
  - Collector reuse log when existing asset is reused.

### Tests
- Added `test/collector.integration.test.js`:
  - Verifies duplicate resource links are fetched once and reruns do not redownload.

- Added service-level idempotency test in `test/services.test.js`:
  - Verifies `materializeArticle` skips already-materialized URLs without fetching.

- Full suite verified passing after fixes.
