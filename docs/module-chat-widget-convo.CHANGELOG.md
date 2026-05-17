# Conversation Visualizer - Changelog

## Version 1.1.0 - January 15, 2026

### Removed
- **Sunburst/Radial View**: Removed the circular radial visualization as it was less practical than expected
  - Now only two views: Sankey Flow and Collapsible Tree
  - Simplified UI with just two toggle buttons

### Enhanced
- **Tree View Controls Panel**: Added interactive controls panel (collapsible)
  - **Node Spacing Options**: Three spacing levels (compact, normal, spread-out)
  - **Expand All**: Button to expand all collapsed nodes at once
  - **Collapse All**: Button to collapse all nodes at once
  - Panel can be collapsed to maximize viewing area
  - Styled to match the knowledge graph component from module-charts2-dendrogram.js

- **Improved Tree Spacing**: 
  - Default spacing increased from 180px to 200px horizontal
  - Compact: 120px horizontal spacing
  - Normal: 200px horizontal spacing (default)
  - Spread: 300px horizontal spacing
  - Dynamic node separation adjusts based on spacing setting

### Files Changed
- `module-chat-widget-convo.js` - Main module updates
- `module-chat-widget-convo.README-conversation-visualizer.md` - Updated documentation
- `module-chat-widget-convo.CHANGELOG.md` - This file

---

## Version 1.0.1 - January 15, 2026

### Fixed
- **Sankey Diagram Error**: Fixed `Uncaught TypeError: d3.sankey is not a function` error
  - Added import for `d3-sankey` v0.12 plugin (not included in core D3.js v7)
  - Updated code to use `sankey()` and `sankeyLinkHorizontal()` from the imported plugin
  - **Breaking Change**: None - fully backward compatible
  - **File Changed**: `module-chat-widget-convo.js` lines 4 and 253-254

### Technical Details
The d3-sankey plugin must be imported separately as it's not part of the core D3.js library. The fix imports the plugin from CDN:

```javascript
import { sankey, sankeyLinkHorizontal } from "https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm";
```

Then uses these imported functions instead of trying to call them on the d3 object:

```javascript
// Before (caused error):
const sankey = d3.sankey()
.attr('d', d3.sankeyLinkHorizontal())

// After (works correctly):
const sankeyLayout = sankey()
.attr('d', sankeyLinkHorizontal())
```

### Files Updated
1. `module-chat-widget-convo.js` - Main module (added import and updated usage)
2. `README-conversation-visualizer.md` - Updated dependencies section
3. `module-chat-widget-convo.QUICK-REFERENCE.md` - Updated dependencies info

### Testing
- ✅ No syntax errors
- ✅ All three views (Sankey, Tree, Sunburst) should now work correctly
- ✅ Demo files ready to test

---

## Version 1.0.0 - January 15, 2026

### Initial Release
- Three visualization modes: Sankey Flow, Collapsible Tree, Sunburst Radial
- Auto-selection of best view based on conversation depth
- Responsive design with fluid layouts
- Interactive tooltips and smooth transitions
- Color heat map for token usage visualization
- Complete documentation and demo files
