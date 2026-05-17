# Conversation Visualizer - Quick Reference Card

## 🚀 Quick Start (30 seconds)

```javascript
import { createConversationVisualizer } from './module-chat-widget-convo.js';

const data = { conversation: { /* your conversation data */ } };
const viz = createConversationVisualizer('container-id', data);
```

## 📋 Files Created

| File | Purpose | Size |
|------|---------|------|
| `module-chat-widget-convo.js` | Main module | ~1000 lines |
| `module-chat-widget-convo.css` | Optional styling | ~400 lines |
| `module-chat-widget-convo-test.html` | Simple demo | Runnable |
| `module-chat-widget-convo-demo.html` | Complex demo | Runnable |
| `module-chat-widget-convo-modal-demo.html` | Modal integration | Runnable |
| `README-conversation-visualizer.md` | Full docs | Complete |
| `IMPLEMENTATION-SUMMARY.md` | Summary | This doc |

## 🎨 Three Visualization Modes

### 1. Sankey Flow (→)
- **Best for:** Shallow conversations (≤3 levels)
- **Shows:** Left-to-right data flow
- **Encoding:** Line thickness = tokens, color = heat

### 2. Tree View (⊞)
- **Best for:** Deep conversations (>3 levels)
- **Shows:** Hierarchical structure
- **Interaction:** Click to expand/collapse

### 3. Sunburst Radial (◉)
- **Best for:** Visual impact, presentations
- **Shows:** Circular rings by depth
- **Interaction:** Click to zoom in/out

## 🎯 Auto-Selection Logic

```
Depth ≤ 3  →  Sankey (default)
Depth > 3  →  Tree (default)
User can toggle to any view anytime
```

## 🌈 Visual Encoding

| Element | Meaning |
|---------|---------|
| 🟢 Green | Low token usage (fast) |
| 🟡 Yellow | Medium token usage |
| 🔴 Red | High token usage (expensive) |
| Thickness | Total tokens (input + output) |
| Hover | Shows detailed metadata |

## 📊 Data Structure (Minimal)

```json
{
  "conversation": {
    "agent": { "title": "Agent Name" },
    "events": [
      { "type": "tool_call", "name": "tool_name" },
      { 
        "type": "agent_call",
        "conversation": { /* recursive */ }
      }
    ],
    "usage": {
      "total_tokens": 1000,
      "estimated_cost": 0.01
    }
  }
}
```

## 🔧 Common Usage Patterns

### Pattern 1: Simple Integration
```javascript
import { createConversationVisualizer } from './module-chat-widget-convo.js';

// In your click handler
function showViz(data) {
  const viz = createConversationVisualizer('my-container', data);
}
```

### Pattern 2: Modal Popup
```javascript
function showInModal(data) {
  const modal = createModalElement();
  const viz = createConversationVisualizer(modal.id, data);
  modal.onClose = () => viz.destroy(); // Cleanup!
}
```

### Pattern 3: Programmatic Control
```javascript
import { ConversationVisualizer } from './module-chat-widget-convo.js';

const viz = new ConversationVisualizer('container', data);
viz.init();

// Switch views programmatically
viz.render('sankey');
viz.render('tree');
viz.render('sunburst');

// Check depth
console.log('Depth:', viz.depth);

// Cleanup
viz.destroy();
```

## 🧪 Testing

### Test in Browser
```bash
# Serve the files (requires web server for ES6 modules)
# Then open in browser:
http://localhost:8080/static/js/module-chat-widget-convo-test.html
http://localhost:8080/static/js/module-chat-widget-convo-demo.html
http://localhost:8080/static/js/module-chat-widget-convo-modal-demo.html
```

### Test Files
- **Simple:** `module-chat-widget-convo-test.html`
- **Complex:** `module-chat-widget-convo-demo.html`
- **Modal:** `module-chat-widget-convo-modal-demo.html`

## 🎨 Optional Styling

Include the CSS file for enhanced styling:
```html
<link rel="stylesheet" href="module-chat-widget-convo.css">
```

Or customize inline:
```javascript
const container = document.getElementById('my-container');
container.style.width = '1200px';
container.style.height = '800px';
container.style.border = '1px solid #ddd';
```

## 📱 Responsive Breakpoints

| Screen Size | Behavior |
|-------------|----------|
| > 768px | Full desktop layout |
| 480-768px | Reduced font sizes |
| < 480px | Stacked controls |

## ⚡ Performance Tips

1. **Optimal data size:**
   - Depth: 2-5 levels
   - Events: 20-50 per conversation
   - Total nodes: < 100

2. **For large conversations:**
   - Use Tree view (better performance)
   - Consider data simplification
   - Enable lazy loading

3. **Memory management:**
   - Always call `viz.destroy()` when done
   - Don't create multiple visualizers on same container

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Not rendering | Check container has width/height |
| Module error | Serve via web server (not file://) |
| Tooltip not showing | Check z-index conflicts |
| Performance slow | Reduce conversation depth/size |
| Colors wrong | Check data.usage.total_tokens exists |

## 📞 Common Issues

**Q: Visualization is blank**
A: Ensure container has explicit dimensions:
```javascript
container.style.width = '100%';
container.style.height = '600px';
```

**Q: ES6 module error**
A: Must serve files through web server (http://), not file:// protocol

**Q: Slow rendering**
A: Switch to Tree view for deep conversations (depth > 5)

**Q: Colors not showing**
A: Verify `usage.total_tokens` exists in your data

## 🔗 Integration Checklist

- [ ] Import module in your script
- [ ] Create container with dimensions
- [ ] Prepare conversation data
- [ ] Call `createConversationVisualizer()`
- [ ] Add cleanup on close/destroy
- [ ] Test all three views
- [ ] Test with real data
- [ ] Add error handling
- [ ] Test responsive behavior
- [ ] Test accessibility (keyboard, screen reader)

## 📚 Reference Links

- Full docs: `README-conversation-visualizer.md`
- Implementation: `IMPLEMENTATION-SUMMARY.md`
- Main module: `module-chat-widget-convo.js`
- Styling: `module-chat-widget-convo.css`

## 🎯 Next Steps

1. Open `module-chat-widget-convo-modal-demo.html` in browser
2. Test all three visualization modes
3. Integrate with your `module-chat-widget.js`
4. Customize colors/styling to match your brand
5. Deploy and gather user feedback

## 📊 API Cheatsheet

```javascript
// Create
const viz = createConversationVisualizer(id, data);

// Or with class
const viz = new ConversationVisualizer(id, data);
viz.init();

// Render specific view
viz.render('sankey');
viz.render('tree');
viz.render('sunburst');

// Properties
viz.depth          // Conversation depth
viz.defaultView    // Auto-selected view
viz.currentView    // Active view

// Cleanup
viz.destroy();
```

## 🎨 Color Customization

Modify color scale in module:
```javascript
// In module-chat-widget-convo.js, line ~115
this.durationColorScale = d3.scaleSequential(d3.interpolateRdYlGn)
  .domain([this.maxDuration, 0]);

// Change to blue scale:
this.durationColorScale = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, this.maxDuration]);
```

---

**Created:** January 15, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready  
**Dependencies:** D3.js v7 (CDN), d3-sankey v0.12 (CDN)
