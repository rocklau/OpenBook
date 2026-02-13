function setupHashRouter() {
  const handle = async () => {
    const h = location.hash;
    if (h.startsWith('#open=')) {
      const link = decodeURIComponent(h.split('=')[1]);
      const res = await obGetJson('/api/articles?limit=100', { action: 'router-open-link' });
      const found = res.find(a => a.link === link);
      if (found) {
        currentArticles = [found];
        renderArticleList([found]);
        selectArticle(0, document.querySelector('.article-item'));
      }
    }
  };
  window.addEventListener('hashchange', handle);
  handle();
}
