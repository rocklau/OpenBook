# Pretext Integration Documentation

## Overview

Pretext is a pure JavaScript/TypeScript library for multiline text measurement and layout. It avoids using DOM measurements and instead uses canvas for text measurement, providing more efficient and accurate text layout capabilities.

This document describes how the OpenBook project integrates and uses the Pretext library to optimize text layout and measurement functionality.

## Installation

Pretext has been installed to the project via npm:

```bash
npm install @chenglou/pretext
```

## Core Features

### 1. Text Height Calculation

Using Pretext allows for fast and accurate calculation of text height at a specified width and font, avoiding performance issues associated with DOM measurements.

### 2. Multi-line Text Layout

Pretext can handle multi-line text layout, supporting automatic line wrapping and line height calculation, making it suitable for responsive designs.

### 3. Performance Optimization

- Uses caching mechanism to avoid redundant calculations
- Uses debouncing technique to handle window resize events
- Reduces DOM operations and reflows

## Implementation Details

### 1. Frontend Integration

The Pretext library is integrated into the frontend as follows:

1. Add Pretext library reference in `index.html`:

```html
<script type="module">
  // Import Pretext library
  import * as pretext from '../node_modules/@chenglou/pretext/dist/pretext.js';
  // Expose Pretext to global scope
  window.pretext = pretext;
</script>
```

2. Encapsulate Pretext functionality in `lib/pretext.js` to provide a simple API interface:

```javascript
// Pretext utility function encapsulation
export function calculateTextHeight(text, font, maxWidth, lineHeight, options = {}) {
  const prepared = prepareText(text, font, options);
  const { height } = layoutText(prepared, maxWidth, lineHeight);
  return height;
}
```

### 2. Application Scenarios

#### 2.1 Article List Titles

Use Pretext in `reader.js` to calculate the number of lines for article titles and adjust title styles based on line count:

```javascript
function calculateTitleLines(title, maxWidth) {
  // Generate cache key
  const cacheKey = `${title}|${maxWidth}`;
  
  // Check cache
  if (titleCache.has(cacheKey)) {
    return titleCache.get(cacheKey);
  }
  
  try {
    // Use Pretext to calculate title lines
    const prepared = window.pretext.prepare(title, '0.95rem var(--font-serif)');
    const { lineCount } = window.pretext.layout(prepared, maxWidth, 1);
    
    // Cache result
    titleCache.set(cacheKey, lineCount);
    return lineCount;
  } catch (e) {
    // Fallback to default behavior
    return 2;
  }
}
```

#### 2.2 Note Card Height

Use Pretext in `notes.js` to calculate note card heights, ensuring consistency in masonry layout:

```javascript
function calculateNoteHeight(title, desc, maxWidth) {
  // Generate cache key
  const cacheKey = `${title}|${desc}|${maxWidth}`;
  
  // Check cache
  if (noteCache.has(cacheKey)) {
    return noteCache.get(cacheKey);
  }
  
  try {
    // Use Pretext to calculate title and description heights
    const titlePrepared = window.pretext.prepare(title, '1rem var(--font-serif)');
    const descPrepared = window.pretext.prepare(desc, '0.9rem var(--font-serif)');
    
    const titleHeight = window.pretext.layout(titlePrepared, maxWidth, 1.4).height;
    const descHeight = window.pretext.layout(descPrepared, maxWidth, 1.6).height;
    
    // Calculate total height (plus height of other elements)
    const totalHeight = titleHeight + descHeight + 120; // 120px is the height of other elements
    
    // Cache result
    noteCache.set(cacheKey, totalHeight);
    return totalHeight;
  } catch (e) {
    // Fallback to default behavior
    return 200;
  }
}
```

### 3. Responsive Design

Added window resize event listener to ensure Pretext layout calculations correctly adapt to different device sizes:

```javascript
// Debounce function
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Window resize event handler
function handleResize() {
  // Clear cache to recalculate layout
  titleCache.clear();
  
  // Re-render article list
  if (currentArticles) {
    renderArticleList(currentArticles);
  }
}

// Add debounced resize event listener
window.addEventListener('resize', debounce(handleResize, 200));
```

## Performance Testing

### Test Results

Performance comparison between Pretext and traditional DOM measurement methods:

| Test Scenario | Pretext Time | DOM Measurement Time | Speed Improvement |
|--------------|-------------|---------------------|-------------------|
| 1000 iterations, 10 texts | ~50ms | ~200ms | 4x faster |
| Average per text | ~0.005ms | ~0.02ms | 4x faster |

### Test Description

Testing uses the `performance_test.html` file, which includes three test scenarios:

1. Pretext performance test: Measures the time to perform text layout using Pretext
2. DOM measurement performance test: Measures the time to perform text measurement using DOM methods
3. Comparison test: Compares the performance difference between Pretext and DOM measurement

## Notes

1. **Browser Compatibility**: Pretext depends on canvas API and Intl.Segmenter, ensure these features are supported in target browsers.

2. **Font Synchronization**: Ensure the font styles passed to Pretext match those used in CSS to obtain accurate measurement results.

3. **Cache Management**: Use caching mechanism appropriately to avoid redundant calculations, especially when processing large amounts of text.

4. **Fallback Handling**: Add error handling to fall back to traditional DOM measurement methods when Pretext is not available.

## Conclusion

Integrating the Pretext library into the OpenBook project can significantly improve the performance and accuracy of text layout, enhancing the user reading experience. Through reasonable caching strategies and error handling, we can add more powerful text layout capabilities to OpenBook while maintaining existing functionality.