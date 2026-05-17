# Visual Guide - Conversation Visualizer Views

## Three Visualization Modes Explained

---

## 1. Sankey Flow View (→)

```
┌────────────────────────────────────────────────────────────────┐
│  User Prompt                                                    │
│      └──[thick line]──> Agent Coordinator                      │
│                              │                                  │
│                              ├──[thin]──> Tool: discover        │
│                              │                                  │
│                              └──[thick]──> Medical Agent        │
│                                                │                │
│                                                ├──> search_codes │
│                                                │                │
│                                                └──> format_csv  │
└────────────────────────────────────────────────────────────────┘

Visual Encoding:
- Line thickness = Total tokens (thicker = more tokens)
- Line color = Heat map (🟢 green = fast, 🔴 red = slow)
- Left to right flow shows progression
- Agents = larger boxes, Tools = smaller boxes
```

**Best For:**
- Shallow conversations (2-3 levels deep)
- Understanding flow of information
- Seeing resource usage at a glance

**Interactions:**
- Hover over lines: Shows token count, type
- Hover over nodes: Shows agent/tool details
- No clicking (static flow)

---

## 2. Collapsible Tree View (⊞)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [●] User Prompt ────────────────────────────────────────┐    │
│                                                            │    │
│      [●] Agent Coordinator ─────────────────────────┐     │    │
│                                                      │     │    │
│          [●] Tool: discover                          │     │    │
│                                                      │     │    │
│          [⊕] Medical Agent (click to expand)        │     │    │
│              │                                       │     │    │
│              └─ [●] Tool: search_codes              │     │    │
│              └─ [●] Tool: format_csv                │     │    │
│                                                            │    │
└────────────────────────────────────────────────────────────────┘

Visual Encoding:
- Circle size = Proportional to token count
- Circle color = Heat map (🟢 green = low, 🔴 red = high)
- [●] = Leaf node (no children)
- [⊕] = Collapsed node (click to expand)
- [⊖] = Expanded node (click to collapse)
```

**Best For:**
- Deep conversations (4+ levels)
- Drilling down into specific branches
- Hiding irrelevant branches

**Interactions:**
- Click node: Expand/collapse children
- Hover: Shows detailed metadata
- Smooth animations on expand/collapse

---

## 3. Sunburst Radial View (◉)

```
┌────────────────────────────────────────────────────────────────┐
│                         ╱────────╲                              │
│                    ╱────────────────╲                          │
│               ╱─────────────────────────╲                      │
│          ╱────────────────────────────────────╲                │
│       ╱──────────────────────────────────────────╲             │
│     │   Ring 3: Sub-Agent Tools                    │           │
│     │ ╱────────────────────────────────────────╲  │           │
│     ││  Ring 2: Medical Agent & Tools           │ │           │
│     ││╱───────────────────────────────────────╲│ │           │
│     │││    Ring 1: Coordinator & Tools        ││ │           │
│     │││  ╱─────────────────────────────────╲  ││ │           │
│     ││││        Center: User Prompt         │ ││ │           │
│     │││  ╲─────────────────────────────────╱  ││ │           │
│     ││╲───────────────────────────────────────╱│ │           │
│     ││                                          │ │           │
│     │ ╲────────────────────────────────────────╱  │           │
│     │                                              │           │
│       ╲──────────────────────────────────────────╱             │
│          ╲────────────────────────────────────╱                │
│               ╲─────────────────────────╱                      │
│                    ╲────────────────╱                          │
│                         ╲────────╱                              │
└────────────────────────────────────────────────────────────────┘

Visual Encoding:
- Each ring = One depth level (center = root)
- Arc length = Token volume (wider = more tokens)
- Arc color = Heat map (🟢 green = low, 🔴 red = high)
- Segments divided by siblings at same level
```

**Best For:**
- Visual presentations / dashboards
- Getting overview of conversation structure
- Impressive visual impact

**Interactions:**
- Click segment: Zoom in (makes it center)
- Click center: Zoom out to parent
- Hover: Shows metadata
- Breadcrumb trail for navigation

---

## Color Heat Map (All Views)

```
Token Usage Scale:

Low                Medium              High
🟢━━━━━━🟡━━━━━━🔴
Green            Yellow            Red

0-25%       25-50%    50-75%     75-100%
percentile  percentile percentile percentile
```

**Color Interpretation:**
- 🟢 **Green (0-25%)**: Efficient, low token usage
- 🟡 **Yellow (25-75%)**: Normal token usage
- 🔴 **Red (75-100%)**: High token usage, expensive

**Applies To:**
- Link/line colors in Sankey
- Node border colors in Tree
- Arc fill colors in Sunburst

---

## Side-by-Side Comparison

| Feature | Sankey | Tree | Sunburst |
|---------|--------|------|----------|
| **Best Depth** | 2-3 | 4-8 | 2-5 |
| **Space Usage** | Wide | Tall | Square |
| **Interaction** | Hover only | Click + Hover | Click + Hover |
| **Visual Impact** | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| **Data Density** | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| **Ease of Use** | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| **Performance** | ★★★★☆ | ★★★★★ | ★★★☆☆ |

---

## Real-World Example

### Scenario: Medical Code Search (3 levels deep)

**Your Data:**
```
User asks: "What are DRG codes for heart failure?"
  ├─ Coordinator Agent
  │  ├─ Tool: discover_agents
  │  └─ Medical Agent
  │     ├─ Tool: search_codes (9500 tokens)
  │     ├─ Tool: format_csv (450 tokens)
  │     └─ Tool: format_csv (420 tokens)
  └─ Response: "Here are the codes..."
```

**How Each View Represents This:**

**Sankey:**
```
[User] ──thick line──> [Coordinator] ──thick──> [Medical Agent]
                              │                        │
                              └──thin──> [discover]    ├──thick──> [search]
                                                       ├──thin──> [format]
                                                       └──thin──> [format]
```

**Tree:**
```
● User
  └─● Coordinator
      ├─● discover (small circle)
      └─● Medical Agent (large circle)
          ├─● search (large circle, red)
          ├─● format (small circle, green)
          └─● format (small circle, green)
```

**Sunburst:**
```
Center: User
Ring 1: Coordinator (70% arc) + discover (30% arc)
Ring 2: Medical Agent full circle
Ring 3: search (80% arc, red) + format + format (20% combined, green)
```

---

## Choosing the Right View

### Use Sankey When:
- ✅ Conversation has 2-3 levels
- ✅ You want to show flow/progression
- ✅ Audience wants simple, linear story
- ❌ Avoid for deep nesting (>3 levels)

### Use Tree When:
- ✅ Conversation has 4+ levels
- ✅ Users need to explore branches
- ✅ Screen space is limited
- ✅ Performance is critical
- ❌ Avoid for wide conversations (50+ parallel events)

### Use Sunburst When:
- ✅ You want visual impact
- ✅ Presenting to stakeholders
- ✅ Showing proportional relationships
- ✅ Square/circular space available
- ❌ Avoid for very deep nesting (>6 levels)

---

## Toggle Controls

All views accessible via buttons:

```
┌──────────────────────────────────────────┐
│  [→ Flow View] [⊞ Tree View] [◉ Radial] │  <- Control Bar
├──────────────────────────────────────────┤
│                                          │
│                                          │
│        Visualization Area                │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

**Buttons:**
- **Active button**: Blue background, white text
- **Inactive button**: White background, gray text
- **Hover**: Light gray background
- **Click**: Smooth transition to new view (750ms)

---

## Responsive Behavior

### Desktop (> 768px)
- All three views work well
- Full labels and details visible
- Recommended container: 1200x800px

### Tablet (480-768px)
- Reduced font sizes
- Smaller node sizes
- Still fully functional
- Recommended: 800x600px

### Mobile (< 480px)
- Controls stack vertically
- Tree view recommended
- Reduced detail level
- Recommended: Full screen

---

## Summary

**Quick Decision Guide:**

```
Conversation Depth?
│
├─ 2-3 levels ──> Use Sankey (default)
│                 Best for simple flows
│
├─ 4-6 levels ──> Use Tree (default)
│                 Best for exploration
│
└─ 7+ levels  ──> Use Tree (required)
                  Only practical option

Presentation Mode?
└─> Use Sunburst regardless of depth
    Most visually striking
```

---

For interactive examples, open:
- `module-chat-widget-convo-test.html`
- `module-chat-widget-convo-demo.html`
- `module-chat-widget-convo-modal-demo.html`
