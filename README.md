# OpenBook

A clean, indie-style RSS reader built with Node.js, featuring both CLI and Web interfaces.

## Features

- Multiple RSS feed subscriptions
- Auto-load OPML subscription files
- Command line interface (CLI)
- Web interface with indie aesthetic
- Responsive design
- Smart content display with iframe embedding for feeds without full content

## Installation

```bash
npm install
```

## Testing

```bash
npm test
```

Tests cover:
- Date filtering logic
- "Today"/"Yesterday" date display
- RSS content detection (full content vs snippet vs iframe)
- Article sorting by date
- Feed statistics calculation

## Usage

### Web Interface

```bash
npm start
```

Then open http://localhost:3000

#### Web Interface Features

- **Three-column layout**: Feeds | Article list | Content
- **Indie aesthetic**: Warm tones, serif typography, minimal design
- **Smart content display**:
  - Full content when available
  - Auto iframe embed when RSS lacks content
  - Toggle between Web view and Snippet view
- **Feed search**: Quickly filter feeds
- **Article stats**: Article count per feed
- **Mobile responsive**: Adapts to smaller screens

### Command Line Tool

```bash
# View all articles
node cli.js

# List all RSS feeds
node cli.js list

# View articles from a specific feed
node cli.js read 1
```

## OPML Files

Place `.opml` files in the project root directory and they will be automatically loaded.

The current directory has 2 OPML files with 200+ feed subscriptions.

## API Endpoints

- `GET /api/feeds` - Get all RSS feeds
- `GET /api/articles` - Get all articles
- `GET /api/feed/:index` - Get articles from a specific feed
- `POST /api/refresh` - Refresh feed list

## Tech Stack

- Node.js
- Express
- rss-parser
- Vanilla JavaScript (frontend)
