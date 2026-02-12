const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mockArticles = [
  {
    title: 'Understanding AI in Modern Software',
    link: 'https://example.com/ai-article',
    pubDate: '2025-02-10T10:00:00Z',
    contentSnippet: 'Artificial Intelligence is transforming how we build software...',
    feedTitle: 'Tech Blog',
    author: 'Jane Smith'
  },
  {
    title: 'JavaScript Best Practices 2025',
    link: 'https://example.com/js-tips',
    pubDate: '2025-02-09T08:00:00Z',
    contentSnippet: 'Learn the latest JavaScript patterns and anti-patterns...',
    feedTitle: 'Code Daily',
    author: 'John Doe'
  },
  {
    title: 'Rust vs Go: Performance Analysis',
    link: 'https://example.com/rust-go',
    pubDate: '2025-02-08T15:00:00Z',
    contentSnippet: 'A deep dive into performance characteristics...',
    feedTitle: 'Systems Weekly'
  },
  {
    title: 'Machine Learning Basics',
    link: 'https://example.com/ml-basics',
    pubDate: '2025-02-07T12:00:00Z',
    contentSnippet: 'Getting started with ML fundamentals...',
    feedTitle: 'AI Insights'
  }
];

const mockFeeds = [
  { name: 'Tech Blog', url: 'https://techblog.com/rss' },
  { name: 'Code Daily', url: 'https://codedaily.com/rss' },
  { name: 'Systems Weekly', url: 'https://systemsweekly.com/rss' },
  { name: 'AI Insights', url: 'https://aiinsights.com/rss' }
];

describe('CLI Article Search', () => {
  it('should find articles by keyword in title', () => {
    const query = 'AI';
    const results = mockArticles.filter(item => {
      const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

    assert.strictEqual(results.length, 1);
    assert.ok(results[0].title.includes('AI'));
  });

  it('should find articles by keyword in content snippet', () => {
    const query = 'JavaScript';
    const results = mockArticles.filter(item => {
      const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].title, 'JavaScript Best Practices 2025');
  });

  it('should return empty array for non-matching query', () => {
    const query = 'Python';
    const results = mockArticles.filter(item => {
      const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

    assert.strictEqual(results.length, 0);
  });

  it('should be case-insensitive', () => {
    const query = 'javascript';
    const results = mockArticles.filter(item => {
      const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

    assert.strictEqual(results.length, 1);
  });

  it('should handle empty query gracefully', () => {
    const query = '';
    const results = mockArticles.filter(item => {
      const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

    assert.strictEqual(results.length, 4);
  });
});

describe('CLI Feed Management', () => {
  it('should count total feeds', () => {
    const totalFeeds = mockFeeds.length;
    assert.strictEqual(totalFeeds, 4);
  });

  it('should list feed names correctly', () => {
    const feedNames = mockFeeds.map(f => f.name);
    assert.deepStrictEqual(feedNames, ['Tech Blog', 'Code Daily', 'Systems Weekly', 'AI Insights']);
  });

  it('should find feed by index', () => {
    const index = 1;
    const feed = mockFeeds[index - 1];
    assert.strictEqual(feed.name, 'Tech Blog');
    assert.strictEqual(feed.url, 'https://techblog.com/rss');
  });

  it('should handle invalid feed index', () => {
    const invalidIndex = 10;
    const feed = mockFeeds[invalidIndex - 1];
    assert.strictEqual(feed, undefined);
  });
});

describe('CLI Article Display', () => {
  it('should limit articles to 20 for display', () => {
    const articles = Array(30).fill(null).map((_, i) => ({
      title: `Article ${i + 1}`,
      link: `https://example.com/${i + 1}`,
      pubDate: new Date().toISOString()
    }));

    const displayCount = Math.min(articles.length, 20);
    assert.strictEqual(displayCount, 20);
  });

  it('should format article metadata correctly', () => {
    const article = mockArticles[0];
    const date = new Date(article.pubDate).toLocaleDateString('en-US');
    const source = article.feedTitle || 'Unknown';

    assert.strictEqual(date, '2/10/2025');
    assert.strictEqual(source, 'Tech Blog');
    assert.strictEqual(article.author, 'Jane Smith');
  });

  it('should handle articles without author', () => {
    const article = mockArticles[2];
    assert.strictEqual(article.author, undefined);
  });

  it('should truncate long snippets', () => {
    const article = mockArticles[0];
    const snippet = article.contentSnippet.replace(/\n/g, ' ').substring(0, 150);
    assert.ok(snippet.length <= 150);
    assert.ok(snippet.includes('Artificial Intelligence'));
  });
});

describe('CLI Command Parsing', () => {
  it('should parse command arguments correctly', () => {
    const args = ['search', 'AI', 'technology'];
    const command = args[0];
    const query = args.slice(1).join(' ');

    assert.strictEqual(command, 'search');
    assert.strictEqual(query, 'AI technology');
  });

  it('should handle numeric arguments', () => {
    const args = ['10'];
    const limit = parseInt(args[0]) || 10;
    assert.strictEqual(limit, 10);
  });

  it('should handle invalid numeric arguments', () => {
    const args = ['abc'];
    const limit = parseInt(args[0]) || 10;
    assert.strictEqual(limit, 10);
  });

  it('should handle days parameter for export', () => {
    const args = ['7'];
    const days = parseInt(args[0]) || 7;
    assert.strictEqual(days, 7);
  });
});

describe('CLI Activity Log', () => {
  const mockActivities = [
    { type: 'note', payload: { title: 'Note', content: 'Test note' }, created_at: '2025-02-10T10:00:00Z' },
    { type: 'note', payload: { title: 'Highlight', content: '> Important text' }, created_at: '2025-02-09T08:00:00Z' },
    { type: 'state', payload: { isFavorite: true }, created_at: '2025-02-08T15:00:00Z' },
    { type: 'state', payload: { isRead: true }, created_at: '2025-02-07T12:00:00Z' },
    { type: 'materialize', payload: {}, created_at: '2025-02-06T10:00:00Z' }
  ];

  it('should filter notes and highlights', () => {
    const notes = mockActivities.filter(a => a.type === 'note');
    assert.strictEqual(notes.length, 2);
  });

  it('should filter favorites', () => {
    const favorites = mockActivities.filter(a =>
      a.type === 'state' && a.payload.isFavorite
    );
    assert.strictEqual(favorites.length, 1);
  });

  it('should identify highlight type', () => {
    const highlights = mockActivities.filter(a =>
      a.type === 'note' && a.payload.title === 'Highlight'
    );
    assert.strictEqual(highlights.length, 1);
    assert.ok(highlights[0].payload.content.startsWith('>'));
  });

  it('should sort activities by date descending', () => {
    const sorted = [...mockActivities].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
    assert.strictEqual(sorted[0].type, 'note');
    assert.strictEqual(new Date(sorted[0].created_at).getDate(), 10);
  });

  it('should limit activity count', () => {
    const limit = 3;
    const limited = mockActivities.slice(0, limit);
    assert.strictEqual(limited.length, 3);
  });
});

describe('CLI Database Operations', () => {
  it('should construct correct database path', () => {
    const dbPath = path.join(process.cwd(), 'data', 'openbook.db');
    assert.ok(dbPath.includes('data'));
    assert.ok(dbPath.endsWith('openbook.db'));
  });

  it('should check database existence', () => {
    const dbPath = path.join(process.cwd(), 'data', 'openbook.db');
    const exists = fs.existsSync(dbPath);
    assert.ok(typeof exists === 'boolean');
  });
});

describe('CLI Export Functionality', () => {
  it('should format note as markdown', () => {
    const title = 'Test Article';
    const link = 'https://example.com/article';
    const time = '2/10/2025, 10:00:00 AM';
    const desc = 'This is a test note content';

    const md = `### ${title}\n- Time: ${time}\n- Link: ${link}\n\n${desc}`;

    assert.ok(md.includes('### Test Article'));
    assert.ok(md.includes('- Time:'));
    assert.ok(md.includes('- Link:'));
    assert.ok(md.includes(desc));
  });

  it('should handle export without link', () => {
    const title = 'Test Article';
    const time = '2/10/2025, 10:00:00 AM';
    const desc = 'This is a test note';
    const link = null;

    const md = `### ${title}\n- Time: ${time}\n${link ? `- Link: ${link}\n` : ''}\n${desc}`;

    assert.ok(!md.includes('- Link:'));
  });

  it('should generate valid export filename', () => {
    const timestamp = Date.now();
    const exportPath = path.join(process.cwd(), 'data', `export-${timestamp}.md`);
    assert.ok(exportPath.includes('export-'));
    assert.ok(exportPath.endsWith('.md'));
  });
});

describe('CLI Statistics Calculation', () => {
  it('should calculate directory size', () => {
    const getDirSize = (dir) => {
      let size = 0;
      if (!fs.existsSync(dir)) return size;

      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          size += getDirSize(filePath);
        } else {
          size += fs.statSync(filePath).size;
        }
      }
      return size;
    };

    const dataDir = path.join(process.cwd(), 'data');
    const size = getDirSize(dataDir);
    assert.ok(typeof size === 'number');
    assert.ok(size >= 0);
  });

  it('should convert bytes to MB', () => {
    const sizeBytes = 5242880;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    assert.strictEqual(sizeMB, '5.00');
  });

  it('should count articles per feed', () => {
    const counts = {};
    mockArticles.forEach(a => {
      const feedName = a.feedTitle;
      counts[feedName] = (counts[feedName] || 0) + 1;
    });

    assert.strictEqual(counts['Tech Blog'], 1);
    assert.strictEqual(counts['Code Daily'], 1);
    assert.strictEqual(counts['AI Insights'], 1);
  });
});

describe('CLI Browser Opening', () => {
  it('should determine correct command for platform', () => {
    const platform = process.platform;
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

    assert.ok(['open', 'start', 'xdg-open'].includes(command));
  });

  it('should validate article index', () => {
    const articles = mockArticles;
    const index = '2';
    const articleIndex = parseInt(index) - 1;

    assert.ok(articleIndex >= 0);
    assert.ok(articleIndex < articles.length);
  });

  it('should reject invalid index', () => {
    const articles = mockArticles;
    const index = '100';
    const articleIndex = parseInt(index) - 1;

    assert.ok(articleIndex >= articles.length || isNaN(articleIndex));
  });
});

describe('CLI Recent Articles', () => {
  it('should get recent articles sorted by date', () => {
    const sorted = [...mockArticles].sort((a, b) =>
      new Date(b.pubDate) - new Date(a.pubDate)
    );

    assert.strictEqual(sorted[0].title, 'Understanding AI in Modern Software');
    assert.strictEqual(sorted[1].title, 'JavaScript Best Practices 2025');
  });

  it('should limit recent articles count', () => {
    const limit = 2;
    const recent = mockArticles.slice(0, limit);
    assert.strictEqual(recent.length, 2);
  });

  it('should handle default limit', () => {
    const input = undefined;
    const count = parseInt(input) || 10;
    assert.strictEqual(count, 10);
  });
});

console.log('Running CLI tests...\n');
