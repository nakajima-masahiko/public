# CLAUDE.md

This document provides guidance for AI assistants working with this codebase.

## Project Overview

This repository contains a collection of standalone HTML-based web applications. Each application is a single HTML file with inline CSS and JavaScript—there is no build system, bundler, or package manager.

### Main Applications

| File | Purpose | Size |
|------|---------|------|
| `index.html` | FX Correlation Coefficient Heatmap Analysis | ~2,600 lines |
| `jsl-realtime.html` | Japanese Sign Language (JSL) Real-time Recognition Demo | ~2,000 lines |
| `3d-avatar-news-reader.html` | 3D Avatar Economic News Reader with TTS | ~2,500 lines |
| `SlotNumberSelecter.html` | Bingo Slot Number Selector | ~640 lines |
| `tradingView.html` | TradingView Charts Integration | ~240 lines |

### Documentation

- `grok/tools.md` - Tool specifications for Grok/Claude interactions (in Japanese)
- `README.md` - Minimal placeholder

## Technology Stack

**No Build System**: Direct HTML deployment, no npm/yarn, no bundler, no transpilation.

### External Dependencies (via CDN)

- **ECharts 5.4.3** - Data visualization
- **TensorFlow.js** - Machine learning (JSL app)
- **MediaPipe Hands** - Hand pose detection (JSL app)
- **TradingView Widget API** - Financial charts

## Code Conventions

### File Structure

Each HTML file follows this structure:
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>アプリケーション名</title>
  <script src="CDN_URL"></script>
  <style>
    /* All CSS inline */
  </style>
</head>
<body>
  <!-- HTML structure -->
  <script>
    /* All JavaScript inline */
  </script>
</body>
</html>
```

### JavaScript Patterns

1. **ES6+ Syntax**: Use `const`/`let`, arrow functions, template literals, async/await
2. **State Management**: Use plain object literals (e.g., `const appState = { ... }`)
3. **Constants**: Define at module scope with UPPER_SNAKE_CASE
4. **DOM Selection**: Use `getElementById` and `querySelector`, cache elements in constants
5. **Data Persistence**: Use `localStorage` with JSON serialization

### CSS Patterns

1. **CSS Variables**: Define theme colors in `:root`
   ```css
   :root {
     --bg: #0f172a;
     --panel: #1e293b;
     --text: #f8fafc;
     --accent: #38bdf8;
   }
   ```
2. **Layout**: Prefer CSS Grid and Flexbox
3. **Responsiveness**: Use `@media` queries for mobile support
4. **Animations**: Use CSS transitions and keyframe animations

### Accessibility

- Use semantic HTML elements
- Include ARIA attributes: `role="tab"`, `aria-selected`, `aria-controls`
- Maintain proper heading hierarchy

### Language

- UI text: Japanese (日本語)
- Code: English (variable names, comments where needed)
- Commit messages: English or Japanese

## Development Workflow

### Git Branch Naming

Feature branches follow this pattern:
```
<author>/<feature-type>-<short-description>-<ticket-id>
```

Examples:
- `claude/add-claude-documentation-9EKhy`
- `codex/explain-data-format-for-sign-language-recording`

### Commit Messages

- Keep messages concise and descriptive
- English or Japanese is acceptable
- Focus on the "what" and "why"

### Pull Requests

- All changes go through pull requests
- One feature/fix per PR
- Feature branches are deleted after merge

## Testing

**No automated testing infrastructure**. All testing is manual through the browser.

When making changes:
1. Open the HTML file directly in a browser
2. Test all affected functionality
3. Verify responsive design on different screen sizes
4. Check browser console for errors

## Common Tasks

### Adding a New Feature

1. Identify the target HTML file
2. Add CSS in the `<style>` section
3. Add HTML elements in the `<body>`
4. Add JavaScript in the `<script>` section
5. Test manually in the browser

### Modifying Existing Code

1. Read the entire relevant section to understand context
2. Preserve existing patterns and conventions
3. Keep changes minimal and focused
4. Test thoroughly before committing

### Working with localStorage

```javascript
// Save data
localStorage.setItem('key', JSON.stringify(data));

// Load data
const data = JSON.parse(localStorage.getItem('key')) || defaultValue;
```

## Architecture Notes

### index.html (FX Correlation Heatmap)

- Uses ECharts for heatmap visualization
- Tab-based UI for different control sections
- Snapshot gallery for saving/comparing states
- Real-time correlation coefficient calculations

### jsl-realtime.html (Sign Language Recognition)

- TensorFlow.js with KNN classifier for recognition
- MediaPipe Hands for hand pose detection
- Canvas overlay for hand landmark visualization
- Recording functionality with data preview
- SVG animations for sign language demonstration

### 3d-avatar-news-reader.html (News Reader)

- Web Speech API for text-to-speech
- 3D avatar with emotion expressions
- Multiple news feed integration
- Voice selection and playback controls

### tradingView.html (TradingView Charts)

- TradingView Widget API integration
- Settings persistence via localStorage
- Custom chart configuration panel

## Performance Considerations

- Use `requestAnimationFrame` for animations
- Cache DOM element references
- Debounce expensive operations (e.g., resize handlers)
- Avoid excessive reflows/repaints

## Security Notes

- All applications run client-side only
- No server-side processing or API keys in code
- Data stored in localStorage (user's browser only)
- External libraries loaded via HTTPS CDN

## Important Reminders for AI Assistants

1. **Read before editing**: Always read the full context of code sections before making changes
2. **Preserve patterns**: Match existing code style and conventions
3. **Minimize changes**: Make focused, minimal edits—avoid unnecessary refactoring
4. **Test instructions**: Provide clear manual testing steps for changes
5. **Japanese UI**: Keep user-facing text in Japanese unless otherwise specified
6. **No new files**: Prefer editing existing files over creating new ones
7. **No build tools**: Don't suggest adding npm, webpack, or other build infrastructure
