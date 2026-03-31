// Pretext 工具函数封装
// 用于文本布局和测量，避免 DOM 操作和重排

// 注意：Pretext 是一个浏览器端库，只能在前端使用
// 因此这个文件会被前端代码直接引用

// 缓存机制，避免重复计算
const preparedTextCache = new Map();

/**
 * 准备文本用于布局
 * @param {string} text - 要测量的文本
 * @param {string} font - 字体样式，如 "16px Inter"
 * @param {Object} options - 配置选项
 * @returns {Object} 准备好的文本对象
 */
export function prepareText(text, font, options = {}) {
  // 生成缓存键
  const cacheKey = `${text}|${font}|${JSON.stringify(options)}`;
  
  // 检查缓存
  if (preparedTextCache.has(cacheKey)) {
    return preparedTextCache.get(cacheKey);
  }
  
  // 导入 Pretext
  const { prepare } = window.pretext;
  
  // 准备文本
  const prepared = prepare(text, font, options);
  
  // 缓存结果
  preparedTextCache.set(cacheKey, prepared);
  
  return prepared;
}

/**
 * 计算文本布局
 * @param {Object} prepared - 准备好的文本对象
 * @param {number} maxWidth - 最大宽度
 * @param {number} lineHeight - 行高
 * @returns {Object} 布局结果，包含高度和行数
 */
export function layoutText(prepared, maxWidth, lineHeight) {
  // 导入 Pretext
  const { layout } = window.pretext;
  
  // 计算布局
  return layout(prepared, maxWidth, lineHeight);
}

/**
 * 准备带段落的文本
 * @param {string} text - 要测量的文本
 * @param {string} font - 字体样式
 * @param {Object} options - 配置选项
 * @returns {Object} 准备好的文本对象
 */
export function prepareTextWithSegments(text, font, options = {}) {
  // 导入 Pretext
  const { prepareWithSegments } = window.pretext;
  
  return prepareWithSegments(text, font, options);
}

/**
 * 计算带段落的文本布局
 * @param {Object} prepared - 准备好的文本对象
 * @param {number} maxWidth - 最大宽度
 * @param {number} lineHeight - 行高
 * @returns {Object} 布局结果，包含高度、行数和段落信息
 */
export function layoutTextWithLines(prepared, maxWidth, lineHeight) {
  // 导入 Pretext
  const { layoutWithLines } = window.pretext;
  
  return layoutWithLines(prepared, maxWidth, lineHeight);
}

/**
 * 清除缓存
 */
export function clearPretextCache() {
  preparedTextCache.clear();
  
  // 导入 Pretext
  const { clearCache } = window.pretext;
  clearCache();
}

/**
 * 计算文本高度
 * @param {string} text - 要测量的文本
 * @param {string} font - 字体样式
 * @param {number} maxWidth - 最大宽度
 * @param {number} lineHeight - 行高
 * @param {Object} options - 配置选项
 * @returns {number} 文本高度
 */
export function calculateTextHeight(text, font, maxWidth, lineHeight, options = {}) {
  const prepared = prepareText(text, font, options);
  const { height } = layoutText(prepared, maxWidth, lineHeight);
  return height;
}

/**
 * 计算文本行数
 * @param {string} text - 要测量的文本
 * @param {string} font - 字体样式
 * @param {number} maxWidth - 最大宽度
 * @param {Object} options - 配置选项
 * @returns {number} 文本行数
 */
export function calculateTextLines(text, font, maxWidth, options = {}) {
  const prepared = prepareText(text, font, options);
  const { layout } = window.pretext;
  const { lineCount } = layout(prepared, maxWidth, 1); // lineHeight 设为 1，只计算行数
  return lineCount;
}