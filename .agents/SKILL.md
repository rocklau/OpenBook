# OpenBook CLI Skill

## Purpose
This skill is for **using OpenBook from the command line**.

For architecture, code-layer responsibilities, and development conventions, refer to `AGENTS.md`.

## When to Use
Use this skill when the task is about:
- Running OpenBook CLI commands.
- Discovering available CLI subcommands/options.
- Exporting or inspecting data through CLI output.
- Troubleshooting CLI invocation issues.

## Quick Start
```bash
node cli.js help
```

## Core Commands
```bash
# Show general help
node cli.js help

# Run CLI entrypoint (default behavior)
node cli.js

# Build or inspect the book index as JSON
node cli.js book index --json

# Start the web app (non-CLI, but commonly paired)
npm start

# Run test suite
npm test
```

## Practical CLI Workflow
1. Check command help first:
   ```bash
   node cli.js help
   ```
2. Run the target command with explicit flags (for reproducibility).
3. If output is large, redirect to a file:
   ```bash
   node cli.js book index --json > /tmp/openbook-index.json
   ```
4. Validate behavior with focused tests when relevant:
   ```bash
   node --test test/cli.test.js
   ```

## Common Troubleshooting
- If a command is unknown, re-run:
  ```bash
  node cli.js help
  ```
- If output looks stale, confirm data/state sources used by the command.
- For broader system behavior (API/sync/storage), use guidance in `AGENTS.md`.

## Notes
- Keep this file CLI-oriented.
- Keep development/process rules in `AGENTS.md`.
