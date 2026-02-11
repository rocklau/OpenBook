# OpenBook

A personal, indie-style RSS reader and knowledge collector built with Node.js. Designed for **Humans** and optimized for **AI Agents**. OpenBook doesn't just read feeds; it helps you capture, materialize, and organize knowledge in a format both you and your LLMs will love.

![OpenBook Interface](./reader_interface.png)
*Modern, integrated indie-style multi-column reader and notes interface.*

## Core Features

- **Integrated Knowledge Workflow**: Seamlessly switch between **Reader** and **Notes** modes within a single unified interface.
- **Multi-source RSS Reading**: Follow your favorite blogs and news sites with OPML support.
- **Knowledge Waterfall**: A refined activity feed that captures your high-value actions: **Favorites**, **Notes**, and **Highlights**.
- **Indie Aesthetic**: Warm tones, serif typography, and a minimal, focused design optimized for deep reading.
- **Deep Linking**: Jump directly from a note or highlight back to the exact article in the reader.

## Knowledge Collection Features

OpenBook goes beyond simple reading with powerful gathering tools:

- **Article Materialization**: Fetch full article content and convert it into clean Markdown with YAML front matter for your personal archive.
- **Resource Collection**: Automatically download and localize images/resources within saved articles for offline access.
- **Note-taking & Highlighting**: Create Markdown notes or save text selections as highlights directly linked to articles.
- **Markdown Export**: Export your curated activity into a structured Markdown table, perfect for Obsidian or Notion.
- **Local-First**: All your data lives in your filesystem. No complex APIs, perfect for local RAG (Retrieval-Augmented Generation).

## Data Structure (AI-Native)

OpenBook stores everything in a transparent, file-based structure that AI agents can easily parse:

```text
data/
├── articles/             # Materialized articles (HTML -> MD)
│   └── 2026/
│       └── 02/
│           ├── example-article.md
│           └── example-article-assets/  # Localized images/resources
├── notes/                # User notes and highlights
├── openbook.db           # SQLite database for state and activity logs
└── index.json            # Grep-friendly index of feeds and articles
```

## Installation

```bash
npm install
```

## Usage

### Web Interface

```bash
npm start
```

Access the interface at `http://localhost:3000`. Use the toggle at the top of the sidebar to switch between **Reader** and **Notes** views.

### Command Line Tool

OpenBook preserves its roots with a fully functional CLI.

```bash
# View recent articles
node cli.js

# List all RSS feeds
node cli.js list

# Read a specific article
node cli.js read 1
```

## Tech Stack

- **Backend**: Node.js, Express, SQLite (via `better-sqlite3`)
- **RSS Engine**: `rss-parser`
- **Markdown**: `turndown` for HTML-to-MD conversion
- **Frontend**: Vanilla JavaScript (Modern ES6+), CSS Grid/Flexbox

## Development and Testing

The project includes unit and integration tests covering core logic and knowledge workflows:

```bash
npm test
# To run integration tests specifically:
node --test test/integration.test.js
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/feeds` | GET | List all subscriptions |
| `/api/articles` | GET | List recent articles |
| `/api/article/materialize` | POST | Fetch and save article as Markdown |
| `/api/article/state` | POST | Update read/favorite status |
| `/api/article/note` | POST | Create a note or highlight |
| `/api/activity` | GET | Fetch refined activity log (Favs, Notes, Highlights) |
| `/api/export/markdown` | GET | Export activity as Markdown review |
