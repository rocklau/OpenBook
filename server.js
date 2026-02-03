const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const RSSReader = require('./rss');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const reader = new RSSReader();

async function initFeeds() {
  const files = fs.readdirSync('.');
  const opmlFiles = files.filter(f => f.endsWith('.opml'));
  
  for (const file of opmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    await reader.loadFromOPML(content);
  }

  if (reader.feeds.length === 0) {
    reader.addFeed('https://news.ycombinator.com/rss', 'Hacker News');
    reader.addFeed('https://www.reddit.com/r/programming/.rss', 'r/programming');
  }
  
  console.log(`Loaded ${reader.feeds.length} RSS feeds`);
}

app.get('/api/feeds', (req, res) => {
  res.json(reader.feeds);
});

// Get recent articles (limited to prevent timeout)
app.get('/api/articles', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const articles = await reader.getAllArticles(limit);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get articles by date (for date navigation)
app.get('/api/articles/by-date', async (req, res) => {
  try {
    const dateParam = req.query.date;
    const date = dateParam ? new Date(dateParam) : new Date();
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    
    const articles = await reader.getArticlesByDate(date);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles by date:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/feed/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= reader.feeds.length) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    const feed = reader.feeds[index];
    const parsed = await reader.parseFeed(feed.url);
    
    if (!parsed) {
      return res.status(500).json({ error: 'Failed to parse feed' });
    }
    
    res.json(parsed);
  } catch (error) {
    console.error('Error parsing feed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  reader.feeds = [];
  reader.cache.clear();
  await initFeeds();
  res.json({ message: 'Feeds refreshed', count: reader.feeds.length });
});

initFeeds().then(() => {
  app.listen(PORT, () => {
    console.log(`RSS Reader server running at http://localhost:${PORT}`);
  });
});