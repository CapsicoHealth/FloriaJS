# Conversation Visualizer Module

A responsive, interactive D3.js-based visualization module for multi-agent conversation flows. This module provides two distinct visualization modes to represent complex nested conversations between agents and tools.

## Features

- **Two Visualization Modes:**
  - **Sankey Flow View**: Left-to-right flow diagram showing conversation progression
  - **Collapsible Tree View**: Hierarchical tree with expand/collapse functionality and interactive controls

- **Tree View Controls:**
  - **Node Spacing**: Three spacing options (compact, normal, spread-out)
  - **Expand/Collapse All**: Quickly expand or collapse all nodes
  - **Collapsible Panel**: Controls panel can be collapsed to maximize viewing area

- **Smart Default Selection**: Automatically selects the best view based on conversation depth
- **Responsive Design**: Adapts to container size with fluid layouts
- **Interactive Elements**: Hover tooltips, click interactions, and smooth transitions
- **Visual Encoding**: 
  - Color heat map for token usage/duration (red=high, yellow=medium, green=low)
  - Size/thickness proportional to token volume
  - Distinct styling for agents vs. tools

## Installation

```html
<!-- Import the module -->
<script type="module">
  import { createConversationVisualizer } from './module-chat-widget-convo.js';
</script>
```

The module uses D3.js v7 from CDN (imported automatically).

## Usage

### Basic Usage

```javascript
import { createConversationVisualizer } from './module-chat-widget-convo.js';

// Your conversation data
const conversationData = {
  conversation: {
    agent: {
      id: "agent-123",
      model: "gpt-4",
      provider: "OpenAI",
      title: "Main Agent"
    },
    events: [
      {
        name: "tool_name",
        type: "tool_call"
      },
      {
        conversation: { /* nested conversation */ },
        name: "Sub Agent",
        type: "agent_call"
      }
    ],
    prompt: "User's question",
    response: "Agent's response",
    usage: {
      estimated_cost: 0.0041,
      input_tokens: 1000,
      output_tokens: 250,
      total_tokens: 1250
    }
  },
  execution_time_ms: 5000
};

// Create container
<div id="my-viz-container" style="width: 100%; height: 700px;"></div>

// Initialize visualizer
const visualizer = createConversationVisualizer('my-viz-container', conversationData);
```

### Advanced Usage

```javascript
import { ConversationVisualizer } from './module-chat-widget-convo.js';

// Create instance
const visualizer = new ConversationVisualizer('container-id', conversationData);

// Initialize
visualizer.init();

// Programmatically switch views
visualizer.render('sankey');  // or 'tree' or 'sunburst'

// Get conversation depth
console.log('Depth:', visualizer.depth);

// Get default view selection
console.log('Default view:', visualizer.defaultView);

// Clean up when done
visualizer.destroy();
```

## Data Structure

The module expects conversation data in the following format:

```javascript
{
  "conversation": {
    "agent": {
      "id": "string",           // Agent identifier
      "model": "string",         // Model name
      "provider": "string",      // Provider name
      "title": "string"          // Display name
    },
    "events": [
      {
        "type": "tool_call",     // or "agent_call"
        "name": "string",        // Tool/agent name
        "parameters": {},        // Tool parameters (optional)
        "conversation": {        // For agent_call type (recursive)
          // Same structure as parent conversation
        }
      }
    ],
    "id": "string",              // Conversation identifier
    "prompt": "string",          // User prompt
    "response": "string",        // Agent response
    "usage": {
      "estimated_cost": 0.0,     // Cost in dollars
      "input_tokens": 0,         // Input token count
      "output_tokens": 0,        // Output token count
      "total_tokens": 0          // Total tokens
    }
  },
  "execution_time_ms": 0         // Total execution time
}
```

## Visualization Details

### Sankey Flow View
- **Best for**: Shallow conversations (depth ≤ 3)
- **Layout**: Left-to-right flow
- **Encoding**:
  - Line thickness = total tokens
  - Line color = token usage heat map
  - Node size = fixed (agents larger than tools)
- **Interaction**: Hover for tooltips

### Tree View
- **Best for**: Deep nested conversations (depth > 3)
- **Layout**: Hierarchical tree (left-to-right)
- **Encoding**:
  - Node size = proportional to tokens
  - Node color = token usage heat map
  - Line color = matches node color
- **Interaction**: Click nodes to expand/collapse branches, hover for tooltips

### Sunburst Radial View
- **Best for**: Visual impact and pattern recognition
- **Layout**: Circular, center-outward rings
- **Encoding**:
  - Ring = depth level
  - Arc length = token volume
  - Arc color = token usage heat map
- **Interaction**: Click segments to zoom in, center circle to zoom out, hover for tooltips

## Color Scale

The heat map uses a red-yellow-green gradient:
- 🔴 **Red**: High token usage (>75th percentile)
- 🟡 **Yellow**: Medium token usage (25th-75th percentile)
- 🟢 **Green**: Low token usage (<25th percentile)

## Styling

The module creates its own internal styles. For custom styling, target these classes:

```css
.convo-viz-controls { /* Control bar */ }
.convo-viz-btn { /* View toggle buttons */ }
.convo-viz-container { /* Visualization container */ }
```

## Browser Support

- Modern browsers with ES6 module support
- D3.js v7 compatible browsers
- SVG support required

## Examples

See the included example files:
- `module-chat-widget-convo-test.html` - Simple example with 2-level nesting
- `module-chat-widget-convo-demo.html` - Complex example with 3-level nesting

## API Reference

### `createConversationVisualizer(containerId, conversationData)`
Helper function to create and initialize a visualizer.

**Parameters:**
- `containerId` (string): DOM element ID for the container
- `conversationData` (object): Conversation data structure

**Returns:** `ConversationVisualizer` instance

### `ConversationVisualizer` Class

#### Constructor
```javascript
new ConversationVisualizer(containerId, conversationData)
```

#### Methods

- `init()`: Initialize and render the visualization
- `render(viewType)`: Render specific view ('sankey', 'tree', or 'sunburst')
- `destroy()`: Clean up resources and event listeners

#### Properties

- `containerId`: Container element ID
- `conversationData`: Conversation data
- `currentView`: Currently active view
- `depth`: Maximum conversation depth
- `defaultView`: Auto-selected default view

## Integration with Existing Chat Widget

To integrate with your existing `module-chat-widget.js`:

```javascript
import { createConversationVisualizer } from './module-chat-widget-convo.js';

// In your chat widget, when showing conversation history:
function showConversationVisualization(conversationData) {
  // Create modal or popup with container
  const modal = createModal();
  const container = document.createElement('div');
  container.id = 'conversation-viz-' + Date.now();
  container.style.cssText = 'width: 1200px; height: 800px;';
  modal.appendChild(container);
  
  // Initialize visualizer
  const viz = createConversationVisualizer(container.id, conversationData);
  
  // Clean up on modal close
  modal.addEventListener('close', () => viz.destroy());
}
```

## Performance

- Handles conversations up to 5 levels deep efficiently
- Optimized for conversations with up to 50 events
- Larger conversations may experience slower rendering in Tree/Sunburst views
- Sankey view performs best for wide conversations (many parallel events)

## License

Part of the Capsico Healthcare platform.

## Dependencies

- D3.js v7 (loaded from CDN: https://cdn.jsdelivr.net/npm/d3@7/+esm)
- d3-sankey v0.12 (loaded from CDN: https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm)
- No other external dependencies

## Troubleshooting

**Visualization not appearing:**
- Ensure container has explicit width and height
- Check browser console for errors
- Verify conversation data structure

**Performance issues:**
- Consider simplifying deeply nested conversations
- Use Tree view for depth > 3
- Reduce number of tool calls in events

**Tooltip not showing:**
- Ensure container has `position: relative` or appropriate positioning context
- Check z-index conflicts

## Future Enhancements

Potential improvements:
- Export to PNG/SVG
- Search/filter functionality
- Performance metrics overlay
- Animation of conversation flow
- Comparison view for multiple conversations
- Custom color schemes
