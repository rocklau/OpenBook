const { describe, it } = require('node:test');
const assert = require('node:assert');

// Helper: Create date at midnight UTC for consistent testing
function createUTCDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return d;
}

// Helper: Create article with UTC timestamp
function createArticle(title, year, month, day, hour = 12) {
  return {
    title,
    pubDate: new Date(Date.UTC(year, month - 1, day, hour, 0, 0)).toISOString()
  };
}

// Simulate filterArticlesByDate function (UTC version, avoids timezone issues)
function filterArticlesByDate(articles, date) {
  // Use UTC methods to avoid timezone issues
  const startOfDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));

  const endOfDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23, 59, 59, 999
  ));

  return articles.filter(article => {
    if (!article.pubDate) return false;
    const articleDate = new Date(article.pubDate);
    return articleDate >= startOfDay && articleDate <= endOfDay;
  });
}

// Simulate updateDateDisplay function (UTC version)
function getDateDisplayText(currentDate, today) {
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const selectedDate = new Date(currentDate);
  // Compare by UTC date components
  const isSameDay = selectedDate.getUTCFullYear() === today.getUTCFullYear() &&
    selectedDate.getUTCMonth() === today.getUTCMonth() &&
    selectedDate.getUTCDate() === today.getUTCDate();

  const isYesterday = selectedDate.getUTCFullYear() === yesterday.getUTCFullYear() &&
    selectedDate.getUTCMonth() === yesterday.getUTCMonth() &&
    selectedDate.getUTCDate() === yesterday.getUTCDate();

  if (isSameDay) {
    return 'Today';
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    return selectedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'UTC'
    });
  }
}

describe('Date Filter Tests', () => {
  const mockArticles = [
    createArticle('Article 1', 2025, 2, 3, 10),
    createArticle('Article 2', 2025, 2, 3, 15),
    createArticle('Article 3', 2025, 2, 2, 8),
    createArticle('Article 4', 2025, 2, 1, 20),
    { title: 'Article 5', pubDate: null },
  ];

  describe('filterArticlesByDate', () => {
    it('should filter articles for today (Feb 3)', () => {
      const today = createUTCDate(2025, 2, 3);
      const result = filterArticlesByDate(mockArticles, today);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].title, 'Article 1');
      assert.strictEqual(result[1].title, 'Article 2');
    });

    it('should filter articles for yesterday (Feb 2)', () => {
      const yesterday = createUTCDate(2025, 2, 2);
      const result = filterArticlesByDate(mockArticles, yesterday);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Article 3');
    });

    it('should return empty array when no articles match', () => {
      const futureDate = createUTCDate(2025, 2, 10);
      const result = filterArticlesByDate(mockArticles, futureDate);

      assert.strictEqual(result.length, 0);
    });

    it('should handle articles without pubDate', () => {
      const today = createUTCDate(2025, 2, 3);
      const result = filterArticlesByDate(mockArticles, today);

      const noDateArticle = result.find(a => a.title === 'Article 5');
      assert.strictEqual(noDateArticle, undefined);
    });
  });

  describe('getDateDisplayText', () => {
    const today = createUTCDate(2025, 2, 3);

    it('should return "Today" for current date', () => {
      const result = getDateDisplayText(today, today);
      assert.strictEqual(result, 'Today');
    });

    it('should return "Yesterday" for previous day', () => {
      const yesterday = createUTCDate(2025, 2, 2);
      const result = getDateDisplayText(yesterday, today);
      assert.strictEqual(result, 'Yesterday');
    });

    it('should return formatted date for other days', () => {
      const otherDay = createUTCDate(2025, 2, 1);
      const result = getDateDisplayText(otherDay, today);

      // Should be something like "Sat, Feb 1"
      assert.ok(result.includes('Feb'));
      assert.ok(result.includes('1'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty articles array', () => {
      const today = createUTCDate(2025, 2, 3);
      const result = filterArticlesByDate([], today);

      assert.strictEqual(result.length, 0);
    });

    it('should handle late night articles correctly', () => {
      // Article at 23:00 UTC on Feb 2 should still be Feb 2
      const article = createArticle('Late Article', 2025, 2, 2, 23);
      const feb2 = createUTCDate(2025, 2, 2);

      const result = filterArticlesByDate([article], feb2);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Late Article');
    });

    it('should handle early morning articles correctly', () => {
      // Article at 01:00 UTC on Feb 3 should be Feb 3
      const article = createArticle('Early Article', 2025, 2, 3, 1);
      const feb3 = createUTCDate(2025, 2, 3);

      const result = filterArticlesByDate([article], feb3);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Early Article');
    });
  });
});

describe('Integration: Date Navigation Flow', () => {
  it('should simulate navigating through dates', () => {
    const mockArticles = [
      createArticle('Today Article', 2025, 2, 3, 10),
      createArticle('Yesterday Article', 2025, 2, 2, 10),
    ];

    let currentDate = createUTCDate(2025, 2, 3);

    // Check today
    let articles = filterArticlesByDate(mockArticles, currentDate);
    assert.strictEqual(articles.length, 1);
    assert.strictEqual(articles[0].title, 'Today Article');

    // Navigate to yesterday
    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    articles = filterArticlesByDate(mockArticles, currentDate);
    assert.strictEqual(articles.length, 1);
    assert.strictEqual(articles[0].title, 'Yesterday Article');

    // Navigate back to today
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    articles = filterArticlesByDate(mockArticles, currentDate);
    assert.strictEqual(articles.length, 1);
    assert.strictEqual(articles[0].title, 'Today Article');
  });
});

console.log('Running tests...\n');