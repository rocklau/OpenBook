async function loadFeeds() {
  try {
    feeds = await obGetJson('/api/feeds', { action: 'load-feeds' });
    renderFeedList();
  } catch (e) {}
}

function renderFeedList() {
  const list = document.getElementById('feedList');
  const search = document.getElementById('feedSearch').value.toLowerCase();
  const filtered = feeds.filter(f => f.name.toLowerCase().includes(search));

  list.innerHTML = `
    <li class="feed-item ${currentFeed === 'all' ? 'active' : ''}" onclick="selectFeed('all')">
      <span class="name">By Date</span>
    </li>
    ${filtered.map((f, i) => `
      <li class="feed-item ${currentFeed === i ? 'active' : ''}" onclick="selectFeed(${feeds.indexOf(f)})">
        <span class="name">${f.name}</span>
      </li>
    `).join('')}
  `;
  document.getElementById('feedStats').textContent = `${feeds.length} feeds`;
}

function filterFeeds() { renderFeedList(); }

function toggleMobileSidebar(show) {
  const s = document.querySelector('.sidebar');
  if (show) s.classList.add('active');
  else s.classList.remove('active');
}

function closeMobileSidebar() { toggleMobileSidebar(false); }

async function selectFeed(index) {
  currentFeed = index;
  switchToReaderView();
  closeMobileSidebar();
  if (index === 'all') {
    loadArticlesByDate(new Date());
  } else {
    const articleList = document.getElementById('articleList');
    articleList.innerHTML = '<div class="spinner"></div>';
    try {
      const parsed = await obGetJson(`/api/feed/${index}`, { action: 'select-feed' });
      currentArticles = parsed.items;
      renderArticleList(currentArticles);
      document.getElementById('listSubtitle').textContent = `${currentArticles.length} articles`;
      document.getElementById('currentDate').textContent = feeds[index].name;
    } catch (e) {}
  }
  renderFeedList();
}

async function loadArticlesByDate(date) {
  currentDate = date;
  const articleList = document.getElementById('articleList');
  articleList.innerHTML = '<div class="spinner"></div>';
  updateDateDisplay();
  try {
    currentArticles = await obGetJson(`/api/articles/by-date?date=${date.toISOString().split('T')[0]}`, { action: 'load-by-date' });
    renderArticleList(currentArticles);
    document.getElementById('listSubtitle').textContent = `${currentArticles.length} articles`;
  } catch (e) {}
}

function updateDateDisplay() {
  const d = document.getElementById('currentDate');
  const today = new Date().toISOString().split('T')[0];
  const sel = currentDate.toISOString().split('T')[0];
  d.textContent = today === sel ? 'Today' : currentDate.toLocaleDateString();
}

function changeDate(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  loadArticlesByDate(currentDate);
}

// 缓存文章标题的准备结果
const titleCache = new Map();

function calculateTitleLines(title, maxWidth) {
  // 生成缓存键
  const cacheKey = `${title}|${maxWidth}`;
  
  // 检查缓存
  if (titleCache.has(cacheKey)) {
    return titleCache.get(cacheKey);
  }
  
  try {
    // 使用 Pretext 计算标题行数
    const prepared = window.pretext.prepare(title, '0.95rem var(--font-serif)');
    const { lineCount } = window.pretext.layout(prepared, maxWidth, 1);
    
    // 缓存结果
    titleCache.set(cacheKey, lineCount);
    return lineCount;
  } catch (e) {
    // 降级到默认行为
    return 2;
  }
}

function renderArticleList(items) {
  const list = document.getElementById('articleList');
  const itemWidth = list.clientWidth - 60; // 减去 padding
  
  list.innerHTML = items.map((item, i) => {
    const lineCount = calculateTitleLines(item.title, itemWidth);
    const titleClass = lineCount > 2 ? 'article-item-title long-title' : 'article-item-title';
    
    return `
      <li class="article-item ${item.isRead ? 'is-read' : ''}" onclick="selectArticle(${i}, this)">
        <div class="${titleClass}">${item.title}</div>
        <div class="article-item-meta"><span>${item.feedName || ''}</span></div>
      </li>
    `;
  }).join('');
}

function selectArticle(index, el) {
  currentArticle = currentArticles[index];
  document.querySelectorAll('.article-item').forEach(li => li.classList.remove('active'));
  el.classList.add('active');
  renderArticleContent(currentArticle);

  if (window.innerWidth <= 768) {
    document.getElementById('contentCol').classList.add('active');
    document.body.classList.add('body-has-selection');
  }

  if (!currentArticle.isRead) {
    currentArticle.isRead = true;
    el.classList.add('is-read');
    apiPost('/api/article/state', { articleId: currentArticle.id, isRead: true });
  }
}

function closeArticle() {
  document.getElementById('contentCol').classList.remove('active');
  document.body.classList.remove('body-has-selection');
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// 窗口 resize 事件处理
function handleResize() {
  // 清空缓存，以便重新计算布局
  titleCache.clear();
  
  // 重新渲染文章列表
  if (currentArticles) {
    renderArticleList(currentArticles);
  }
}

// 添加防抖处理的 resize 事件监听器
window.addEventListener('resize', debounce(handleResize, 200));

function renderArticleContent(article) {
  const col = document.getElementById('contentCol');
  const hasFull = article.content || article['content:encoded'];
  const actionsHtml = `
    <div class="actionbar"><div class="actionbar-inner">
      <div class="actionbar-left">
        <button class="action-btn back-btn" onclick="closeArticle()">←</button>
        <button class="action-btn" onclick="toggleFavoriteCurrent()">⭐</button>
        <button class="action-btn" onclick="openNoteEditor()">📝</button>
      </div>
      <div class="actionbar-right"><button class="action-btn" onclick="toggleActivityPanel()">Log</button></div>
    </div>
    <div class="note-editor-container" id="noteEditor">
      <textarea class="note-editor-textarea" id="noteTextarea" placeholder="Write a note..."></textarea>
      <div style="margin-top:10px; display:flex; gap:10px; justify-content:flex-end;">
        <button class="action-btn" onclick="closeNoteEditor()">Cancel</button>
        <button class="action-btn" onclick="saveNote()">Save</button>
      </div>
    </div>
    </div>
  `;

  if (hasFull) {
    col.innerHTML = actionsHtml + `<div class="content-body"><div class="content-body-inner" id="contentBody">${sanitizeHtml(hasFull)}</div></div>`;
  } else {
    col.innerHTML = actionsHtml + `<iframe class="content-iframe" src="${article.link}"></iframe>`;
  }
}
