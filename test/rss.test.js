const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock RSS Parser
const mockFeedData = {
  title: 'Test Blog',
  description: 'A test blog',
  items: [
    {
      title: 'Test Article 1',
      link: 'https://example.com/1',
      pubDate: '2025-02-03T10:00:00Z',
      content: '<p>Full content 1</p>',
      contentSnippet: 'Snippet 1',
      author: 'John Doe'
    },
    {
      title: 'Test Article 2',
      link: 'https://example.com/2',
      pubDate: '2025-02-02T08:00:00Z',
      contentSnippet: 'Snippet 2 only'
    },
    {
      title: 'Test Article 3',
      link: 'https://example.com/3',
      pubDate: '2025-02-01T15:00:00Z'
      // No content or snippet
    }
  ]
};

// Simulate content detection logic from the frontend
function hasFullContent(article) {
  return !!(article.content || article['content:encoded']);
}

function hasSnippet(article) {
  return !!(article.contentSnippet && article.contentSnippet.length > 50);
}

function determineViewMode(article) {
  if (hasFullContent(article)) {
    return 'content';
  } else if (hasSnippet(article)) {
    return 'snippet';
  } else {
    return 'iframe';
  }
}

describe('RSS Content Detection', () => {
  describe('hasFullContent', () => {
    it('should return true for articles with content', () => {
      const article = mockFeedData.items[0];
      assert.strictEqual(hasFullContent(article), true);
    });

    it('should return false for articles without content', () => {
      const article = mockFeedData.items[1];
      assert.strictEqual(hasFullContent(article), false);
    });

    it('should support content:encoded field', () => {
      const article = {
        title: 'Test',
        'content:encoded': '<p>Encoded content</p>'
      };
      assert.strictEqual(hasFullContent(article), true);
    });
  });

  describe('hasSnippet', () => {
    it('should return true for articles with long snippet', () => {
      const article = {
        contentSnippet: 'This is a long snippet that exceeds fifty characters for sure'
      };
      assert.strictEqual(hasSnippet(article), true);
    });

    it('should return false for articles with short snippet', () => {
      const article = {
        contentSnippet: 'Short'
      };
      assert.strictEqual(hasSnippet(article), false);
    });

    it('should return false when snippet is missing', () => {
      const article = mockFeedData.items[2];
      assert.strictEqual(hasSnippet(article), false);
    });
  });

  describe('determineViewMode', () => {
    it('should return "content" when full content exists', () => {
      const article = mockFeedData.items[0];
      assert.strictEqual(determineViewMode(article), 'content');
    });

    it('should return "iframe" when no content or snippet', () => {
      const article = mockFeedData.items[2];
      assert.strictEqual(determineViewMode(article), 'iframe');
    });
  });
});

describe('Article Sorting', () => {
  it('should sort articles by date descending', () => {
    const sorted = [...mockFeedData.items].sort((a, b) => {
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    assert.strictEqual(sorted[0].title, 'Test Article 1'); // Feb 3
    assert.strictEqual(sorted[1].title, 'Test Article 2'); // Feb 2
    assert.strictEqual(sorted[2].title, 'Test Article 3'); // Feb 1
  });

  it('should handle articles without pubDate', () => {
    const articles = [
      { title: 'A', pubDate: '2025-02-03T10:00:00Z' },
      { title: 'B', pubDate: null },
      { title: 'C', pubDate: '2025-02-02T10:00:00Z' }
    ];

    const sorted = articles.sort((a, b) => {
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    // Articles without date should be at the end
    assert.strictEqual(sorted[2].title, 'B');
  });
});

describe('Feed Statistics', () => {
  const feeds = [
    { name: 'Feed A', url: 'https://a.com/rss' },
    { name: 'Feed B', url: 'https://b.com/rss' },
    { name: 'Feed C', url: 'https://c.com/rss' }
  ];

  const articles = [
    { title: 'A1', feedName: 'Feed A' },
    { title: 'A2', feedName: 'Feed A' },
    { title: 'B1', feedName: 'Feed B' },
    { title: 'C1', feedName: 'Feed C' },
    { title: 'C2', feedName: 'Feed C' },
    { title: 'C3', feedName: 'Feed C' }
  ];

  it('should count articles per feed', () => {
    const counts = {};
    articles.forEach(a => {
      const feedName = a.feedName;
      counts[feedName] = (counts[feedName] || 0) + 1;
    });

    assert.strictEqual(counts['Feed A'], 2);
    assert.strictEqual(counts['Feed B'], 1);
    assert.strictEqual(counts['Feed C'], 3);
  });

  it('should calculate total feeds and articles', () => {
    const totalFeeds = feeds.length;
    const totalArticles = articles.length;

    assert.strictEqual(totalFeeds, 3);
    assert.strictEqual(totalArticles, 6);
  });
});

console.log('Running RSS tests...\n');
