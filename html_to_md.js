const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');

function htmlToMarkdown(html, { baseUrl } = {}) {
  const dom = new JSDOM(html, { url: baseUrl || 'https://example.com' });
  const document = dom.window.document;

  // Remove scripts/styles/noscript
  document.querySelectorAll('script,style,noscript,iframe').forEach(n => n.remove());

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });

  // Keep links/images
  turndown.addRule('image', {
    filter: 'img',
    replacement(content, node) {
      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      if (!src) return '';
      return `![${alt}](${src})`;
    }
  });

  const main = document.querySelector('article') || document.body;
  const md = turndown.turndown(main);
  return md.trim();
}

module.exports = {
  htmlToMarkdown
};
