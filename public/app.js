let feeds = [];
let articles = [];
let currentFeed = 'all';
let currentArticle = null;
let currentArticles = [];
let currentDate = new Date();
let isDateFilterMode = true;

async function init() {
  await loadFeeds();
  await loadArticlesByDate(new Date());
  setupHashRouter();
  setupHighlightPopover();
  setupNotesInfiniteScroll();

  if (document.body.classList.contains('body-view-notes')) {
    refreshNotes();
  }
}
