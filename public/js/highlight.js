let highlightSaving = false;

function setupHighlightPopover() {
  const btn = document.getElementById('highlightBtn');
  document.addEventListener('mouseup', () => {
    const s = window.getSelection();
    const text = s.toString().trim();
    const content = document.getElementById('contentBody');
    if (text && text.length > 3 && content && content.contains(s.anchorNode)) {
      const range = s.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      btn.style.left = (rect.left + rect.width / 2 - btn.offsetWidth / 2) + 'px';
      btn.style.top = (rect.top + window.scrollY - 45) + 'px';
      btn.style.position = 'absolute';
      btn.style.display = 'block';
    } else {
      btn.style.display = 'none';
    }
  });
}

async function clipHighlight() {
  const selection = window.getSelection();
  const s = selection ? selection.toString() : '';
  if (!currentArticle || !s || highlightSaving) return;

  highlightSaving = true;
  document.getElementById('highlightBtn').style.display = 'none';

  try {
    const mat = await apiPost('/api/article/materialize', { url: currentArticle.link, title: currentArticle.title });
    await apiPost('/api/article/note', { articleId: mat.articleId, title: 'Highlight', content: `> ${s}` });
    showToast('Highlight saved');
  } finally {
    if (selection) selection.removeAllRanges();
    highlightSaving = false;
  }
}
