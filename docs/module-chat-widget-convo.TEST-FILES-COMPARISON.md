# Test Files Comparison Guide

## Overview of the Three HTML Test Files

### 1. **module-chat-widget-convo-test.html** - Simple Single-Agent Example
**Purpose:** Minimal example to quickly test basic functionality

**Conversation Structure:**
```
User Prompt
  └─ Assistant (gpt-3.5-turbo)
      ├─ Tool: search_database
      └─ Tool: format_results
```

**Characteristics:**
- **Depth:** 1 (no nested agents)
- **Agents:** 1 (Assistant)
- **Tools:** 2 (search_database, format_results)
- **Tokens:** 2,150
- **Cost:** $0.0015
- **Time:** 1.2 seconds
- **Complexity:** Minimal

**Best For:**
- Quick testing of the visualizer
- Understanding basic flow
- Debugging simple issues
- Learning the interface

**Default View:** Sankey Flow (perfect for this simple structure)

---

### 2. **module-chat-widget-convo-demo.html** - Complex Multi-Agent Example
**Purpose:** Realistic complex conversation with multiple levels and parallel agents

**Conversation Structure:**
```
User Prompt
  └─ Coordinator Agent (gpt-4)
      ├─ Tool: discover_agents
      ├─ Tool: analyze_intent
      ├─ Medical Knowledge Agent (claude-3-opus)
      │   ├─ Tool: search_medical_codes
      │   ├─ Tool: validate_codes
      │   ├─ Cardiology Specialist (gpt-4-turbo)
      │   │   ├─ Tool: query_cardiology_db
      │   │   └─ Tool: cross_reference_guidelines
      │   ├─ Tool: format_results
      │   └─ Tool: generate_csv
      ├─ Billing Analysis Agent (gemini-pro)
      │   ├─ Tool: calculate_reimbursement
      │   ├─ Tool: check_coverage
      │   └─ Insurance Policy Agent (claude-3-sonnet)
      │       ├─ Tool: query_policy_database
      │       └─ Tool: check_exclusions
      ├─ Tool: synthesize_results
      └─ Tool: format_final_report
```

**Characteristics:**
- **Depth:** 3 (Coordinator → Medical/Billing → Cardiology/Insurance)
- **Agents:** 5 (Coordinator, Medical, Cardiology, Billing, Insurance)
- **Tools:** 13+ tool calls
- **Tokens:** 28,850
- **Cost:** $0.0185
- **Time:** 45.3 seconds
- **Complexity:** High - includes parallel agent execution

**Best For:**
- Testing all three visualization modes
- Understanding complex agent coordination
- Seeing how parallel paths are visualized
- Stress-testing the visualizer
- Demonstrating to stakeholders

**Default View:** Sankey Flow (but Tree view also works well)

---

### 3. **module-chat-widget-convo-modal-demo.html** - Modal Integration Example
**Purpose:** Shows how to integrate the visualizer into a popup modal

**Features:**
- **Multiple Examples:** Includes 3 conversation samples (simple, medical, complex)
- **Modal Popup:** Demonstrates centered popup with backdrop
- **Button Interface:** Click buttons to show different conversation types
- **Proper Cleanup:** Shows how to destroy visualizer on modal close
- **Responsive:** Modal adapts to screen size (90vw/90vh)

**Includes These Conversation Types:**
1. **Simple (Depth 2):** Single agent with tools
2. **Medical (Depth 3):** Coordinator → Medical → Validator
3. **Complex (Depth 4):** Master → Medical → Cardiology → Researcher + Billing

**Best For:**
- Understanding modal integration
- Seeing production-ready implementation
- Learning cleanup patterns
- Testing multiple conversations quickly
- Understanding responsive design

---

## Quick Comparison Table

| Feature | test.html | demo.html | modal-demo.html |
|---------|-----------|-----------|-----------------|
| **Purpose** | Simple test | Complex demo | Integration example |
| **Depth** | 1 level | 3 levels | Multiple (2-4) |
| **Agents** | 1 | 5 | Various |
| **Tools** | 2 | 13+ | Various |
| **Nested Agents** | ❌ None | ✅ 3 levels | ✅ 2-4 levels |
| **Parallel Agents** | ❌ No | ✅ Yes (Medical + Billing) | ✅ Yes |
| **Modal Popup** | ❌ No | ❌ No | ✅ Yes |
| **Multiple Examples** | ❌ No | ❌ No | ✅ Yes (3 examples) |
| **Best View** | Sankey | Sankey/Tree | Auto-selected |
| **Load Time** | Fast | Fast | Fast |
| **Complexity** | ⭐ Simple | ⭐⭐⭐ Complex | ⭐⭐ Medium |

---

## Recommended Testing Order

### 1. Start with **test.html**
- Open it first to verify basic functionality
- Test all three view toggles
- Hover over elements to see tooltips
- Check console for errors

### 2. Then open **demo.html**
- See how complex nested conversations render
- Notice the parallel agent paths (Medical + Billing)
- Compare Sankey vs Tree vs Sunburst for complex data
- Test performance with larger dataset

### 3. Finally try **modal-demo.html**
- Click each button to see different conversation types
- Test modal open/close behavior
- Verify cleanup (no memory leaks)
- Test responsive behavior (resize window)

---

## Use Cases

### Use **test.html** when:
- ✅ Just starting to learn the visualizer
- ✅ Testing a bug fix
- ✅ Verifying basic functionality
- ✅ Quick sanity check
- ✅ Learning the API

### Use **demo.html** when:
- ✅ Testing complex multi-agent scenarios
- ✅ Evaluating different visualization modes
- ✅ Demonstrating to stakeholders
- ✅ Stress-testing performance
- ✅ Understanding nested agent coordination

### Use **modal-demo.html** when:
- ✅ Integrating into your application
- ✅ Learning modal integration patterns
- ✅ Testing multiple conversation types
- ✅ Understanding cleanup and lifecycle
- ✅ Building production features

---

## Key Differences Summary

### Data Complexity

**test.html:**
```javascript
1 agent → 2 tools = SIMPLE
```

**demo.html:**
```javascript
1 coordinator → 2 parallel agents → 2 nested specialists → 13+ tools = COMPLEX
```

**modal-demo.html:**
```javascript
Multiple conversations of varying complexity in a modal interface
```

### Visual Appearance

**test.html:**
- Clean, minimal
- One agent box, two tool nodes
- Straight lines
- Easy to understand

**demo.html:**
- Dense, detailed
- Multiple agent boxes at different levels
- Curved connections showing hierarchy
- Parallel paths visible
- Rich structure

**modal-demo.html:**
- Button interface to choose examples
- Popup overlay with backdrop
- Close button and ESC key support
- Multiple conversation samples

---

## File Locations

All three files are in:
```
C:\Projects\repos\CapsicoBase\CapsicoWebStatic\WebContent\js\
```

Open them in a web browser (must be served via HTTP, not file://)

---

## Updated: January 15, 2026

The test.html file was simplified to be truly distinct from demo.html:
- **Before:** Both showed 2-level nested conversations (too similar)
- **After:** test.html shows 1-level (single agent), demo.html shows 3-level (complex multi-agent)
- **Result:** Clear progression from simple → complex → integration
