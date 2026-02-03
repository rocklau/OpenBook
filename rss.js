const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'RSS Reader'
  }
});

class RSSReader {
  constructor() {
    this.feeds = [];
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  addFeed(url, name) {
    this.feeds.push({ url, name });
  }

  async parseFeed(url, timeout = 5000) {
    try {
      // Check cache first
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      // Fetch with timeout
      const feed = await Promise.race([
        parser.parseURL(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      const result = {
        title: feed.title || 'Untitled Feed',
        description: feed.description,
        link: feed.link,
        items: (feed.items || []).map(item => ({
          title: item.title || 'Untitled',
          link: item.link,
          pubDate: item.pubDate || item.isoDate,
          content: item['content:encoded'] || item.content,
          contentSnippet: item.contentSnippet,
          author: item.author || item.creator
        }))
      };

      // Cache the result
      this.cache.set(url, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error(`Error parsing ${url}:`, error.message);
      return null;
    }
  }

  // Get all articles with parallel fetching and batch processing
  async getAllArticles(limit = 50) {
    const allArticles = [];
    
    // Fetch feeds in parallel with a concurrency limit
    const batchSize = 10;
    for (let i = 0; i < this.feeds.length; i += batchSize) {
      const batch = this.feeds.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(feed => this.parseFeed(feed.url, 3000))
      );
      
      results.forEach((parsed, idx) => {
        if (parsed) {
          const feed = batch[idx];
          parsed.items.forEach(item => {
            allArticles.push({
              ...item,
              feedTitle: parsed.title,
              feedName: feed.name
            });
          });
        }
      });

      // Stop if we have enough articles
      if (allArticles.length >= limit * 3) break;
    }

    // Sort by date and limit results
    return allArticles
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, limit * 2);
  }

  // Get articles from a specific date (for the date filter feature)
  async getArticlesByDate(date, daysWindow = 1) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + daysWindow);
    endDate.setHours(23, 59, 59, 999);

    const allArticles = await this.getAllArticles(100);
    
    return allArticles.filter(article => {
      if (!article.pubDate) return false;
      const articleDate = new Date(article.pubDate);
      return articleDate >= targetDate && articleDate <= endDate;
    });
  }

  async loadFromOPML(opmlContent) {
    const outlines = opmlContent.match(/<outline[^>]*>/g) || [];
    
    for (const outline of outlines) {
      const xmlUrl = outline.match(/xmlUrl="([^"]+)"/);
      const title = outline.match(/title="([^"]+)"/);
      const text = outline.match(/text="([^"]+)"/);
      
      if (xmlUrl) {
        const name = title ? title[1] : (text ? text[1] : 'Unnamed Feed');
        this.addFeed(xmlUrl[1], name);
      }
    }
  }
}

module.exports = RSSReader;