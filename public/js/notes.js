let notesOffset = 0, notesLimit = 30, notesFinished = false, notesLoading = false;

function setupNotesInfiniteScroll() {
  const col = document.getElementById('notesCol');
  col.addEventListener('scroll', () => {
    if (notesFinished || notesLoading || !document.body.classList.contains('body-view-notes')) return;
    if (col.scrollTop + col.clientHeight >= col.scrollHeight - 300) {
      loadMoreNotes();
    }
  });
}

function switchToNotesView() {
  document.body.classList.add('body-view-notes');
  document.body.classList.remove('body-has-selection');

  document.getElementById('navReader').classList.remove('active');
  document.getElementById('navNotes').classList.add('active');

  const mReader = document.getElementById('mNavReader');
  const mNotes = document.getElementById('mNavNotes');
  if (mReader) mReader.classList.remove('active');
  if (mNotes) mNotes.classList.add('active');

  refreshNotes();
}

function switchToReaderView() {
  document.body.classList.remove('body-view-notes');
  if (window.innerWidth <= 768) {
    document.body.classList.remove('body-has-selection');
  }

  document.getElementById('navReader').classList.add('active');
  document.getElementById('navNotes').classList.remove('active');

  const mReader = document.getElementById('mNavReader');
  const mNotes = document.getElementById('mNavNotes');
  if (mReader) mReader.classList.add('active');
  if (mNotes) mNotes.classList.remove('active');
}

async function refreshNotes() {
  notesOffset = 0; notesFinished = false;
  document.getElementById('notesWaterfall').innerHTML = '';
  await loadMoreNotes();
}

async function loadMoreNotes() {
  if (notesFinished || notesLoading) return;
  notesLoading = true;
  document.getElementById('notesLoading').style.display = 'block';
  try {
    const data = await obGetJson(`/api/activity?limit=${notesLimit}&offset=${notesOffset}`, { action: 'notes-load-more' });
    const items = data.items || [];
    const wf = document.getElementById('notesWaterfall');

    // 缓存笔记内容的准备结果
    const noteCache = new Map();
    
    function calculateNoteHeight(title, desc, maxWidth) {
      // 生成缓存键
      const cacheKey = `${title}|${desc}|${maxWidth}`;
      
      // 检查缓存
      if (noteCache.has(cacheKey)) {
        return noteCache.get(cacheKey);
      }
      
      try {
        // 使用 Pretext 计算标题和描述的高度
        const titlePrepared = window.pretext.prepare(title, '1rem var(--font-serif)');
        const descPrepared = window.pretext.prepare(desc, '0.9rem var(--font-serif)');
        
        const titleHeight = window.pretext.layout(titlePrepared, maxWidth, 1.4).height;
        const descHeight = window.pretext.layout(descPrepared, maxWidth, 1.6).height;
        
        // 计算总高度（加上其他元素的高度）
        const totalHeight = titleHeight + descHeight + 120; // 120px 是其他元素的高度
        
        // 缓存结果
        noteCache.set(cacheKey, totalHeight);
        return totalHeight;
      } catch (e) {
        // 降级到默认行为
        return 200;
      }
    }

    items.forEach(it => {
      const p = it.payload || {};
      if (it.type === 'materialize') return;
      if (it.type === 'state' && !p.isFavorite) return;

      const isHighlight = it.type === 'note' && p.title === 'Highlight';
      const isFav = it.type === 'state' && p.isFavorite;
      const displayType = isHighlight ? 'Highlight' : (isFav ? 'Favorite' : 'Note');

      const title = it.article?.title || p.title || 'Untitled';
      const link = it.article?.link || p.url || '';
      const time = new Date(it.createdAt).toLocaleString();
      const desc = summarizeActivity(it);

      const card = document.createElement('div');
      card.className = 'note-card';
      
      // 计算卡片高度
      const cardWidth = 300; // 卡片的大致宽度
      const cardHeight = calculateNoteHeight(title, desc, cardWidth);
      card.style.minHeight = `${cardHeight}px`;
      
      card.innerHTML = `
        <div class="meta"><span class="type">${displayType}</span><span>${new Date(it.createdAt).toLocaleDateString()}</span></div>
        <div class="title">${title}</div>
        <div class="desc">${desc}</div>
        <div class="actions">
          <button class="action-btn btn-reader" style="font-size:0.7rem">Reader</button>
          ${link ? `<a class="action-btn" style="font-size:0.7rem; text-decoration:none;" href="${link}" target="_blank">Source</a>` : ''}
          <button class="action-btn btn-copy" style="font-size:0.7rem">Copy MD</button>
        </div>
      `;

      card.querySelector('.btn-reader').onclick = () => openInReader(link);
      card.querySelector('.btn-copy').onclick = () => copyNoteMD(title, link, time, desc);
      wf.appendChild(card);
    });

    notesOffset += items.length;
    if (items.length < notesLimit) notesFinished = true;
  } catch (e) {
    console.error('Error loading notes:', e);
  } finally {
    notesLoading = false;
    document.getElementById('notesLoading').style.display = notesFinished ? 'none' : 'block';
    document.getElementById('notesMoreBtn').style.display = (notesFinished || notesOffset === 0) ? 'none' : 'block';
  }
}

async function saveNote() {
  if (!currentArticle) return;
  const content = document.getElementById('noteTextarea').value;
  try {
    const mat = await apiPost('/api/article/materialize', { url: currentArticle.link, title: currentArticle.title });
    await apiPost('/api/article/note', { articleId: mat.articleId, title: 'Note', content });
    showToast('Note saved');
    closeNoteEditor();
    notesOffset = 0;
  } catch (e) {
    showToast('Error saving note');
  }
}

async function toggleFavoriteCurrent() {
  if (!currentArticle) return;
  const mat = await apiPost('/api/article/materialize', { url: currentArticle.link, title: currentArticle.title });
  await apiPost('/api/article/state', { articleId: mat.articleId, isFavorite: true });
  showToast('Favorited');
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
  // 重新加载笔记，以便重新计算布局
  if (document.body.classList.contains('body-view-notes')) {
    refreshNotes();
  }
}

// 添加防抖处理的 resize 事件监听器
window.addEventListener('resize', debounce(handleResize, 200));
