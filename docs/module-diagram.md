# FloriaDiagram — `module-diagram.js`

> Generic node-and-edge diagramming widget built on top of
> [@joint/core 4.x](https://www.jointjs.com/).  
> ES module — import with `import { FloriaDiagram } from '.../module-diagram.js'`.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Dependencies](#2-dependencies)
3. [Quick Start](#3-quick-start)
4. [Constructor & Options](#4-constructor--options)
5. [The Item Contract](#5-the-item-contract)
6. [Public API](#6-public-api)
   - [Diagram lifecycle](#61-diagram-lifecycle)
   - [Item management](#62-item-management)
   - [Serialisation](#63-serialisation)
   - [View controls](#64-view-controls)
   - [Undo / Redo](#65-undo--redo)
   - [Read-only mode](#66-read-only-mode)
   - [Context menu extension](#67-context-menu-extension)
7. [Internal Methods Reference](#7-internal-methods-reference)
8. [Module-level Constants](#8-module-level-constants)
9. [CSS Classes & Selectors](#9-css-classes--selectors)
10. [Architectural Decisions](#10-architectural-decisions)
11. [Known Constraints & Gotchas](#11-known-constraints--gotchas)

---

## 1. Overview

`FloriaDiagram` wraps JointJS into an opinionated, application-facing widget.
The application never touches JointJS directly — it works exclusively with
plain JavaScript **item** objects (see §5) and the public API methods below.

Key features:

| Feature | Detail |
|---|---|
| Node / edge canvas | Rectangular nodes with named in/out ports; manhattan-routed, rounded connectors |
| Pan & zoom | Mouse-drag pan on blank canvas; optional mouse-wheel zoom; clamped to keep canvas visible |
| Undo / redo | Configurable stack depth; Ctrl+Z / Ctrl+Y keyboard shortcuts |
| Context menus | Built-in item menu (Edit, Bring to Front, Send to Back, Remove); extensible via `registerContextMenuItem` |
| Link context menu | Right-click a link to delete a vertex, clear all vertices, or delete the connection |
| Read-only mode | Full pan/zoom; all editing interactions disabled |
| Canvas boundary | Dashed rect drawn behind all cells showing the active work area (maxW × maxH) |
| Serialisation | `serialize()` → plain JSON; `load()` / `deserialize()` to restore |
| `extras` bag | Arbitrary per-item application state that round-trips through serialize/load |
| Disconnected highlight | Optional red outline on unconnected nodes when `serialize()` is called |

---

## 2. Dependencies

| Dependency | Version | How loaded |
|---|---|---|
| `@joint/core` | 4.0.4 | CDN ESM import (`https://cdn.jsdelivr.net/npm/@joint/core@4.0.4/+esm`) |

No build step, no bundler required.  The file is a native ES module and is
loaded with `<script type="module">` or imported by another module.

---

## 3. Quick Start

```html
<div id="myDiagram" style="width:900px;height:600px;"></div>

<script type="module">
import { FloriaDiagram } from '/static/floria.v2.0/module-diagram.js';

const diagram = new FloriaDiagram('myDiagram', {
  zoom      : { min: 0.33, max: 2, wheel: true },
  pan       : true,
  undo      : 30,
  dimensions: { minW: 750, minH: 600, maxW: 1000, maxH: 1000 },
  highlightDisconnected: false
});

// Define an item factory
function makeItem(id, type) {
  return {
    id,
    type,
    extras: {},
    ports : { in: [{ id: 'in', label: '' }], out: [{ id: 'out', label: '' }] },
    draw(element, item) {
      element.attr('label/text',  item.id);
      element.attr('body/fill',   '#eef2ff');
      element.attr('body/stroke', '#5579c6');
    },
    onRemove(item)              { console.log('removed', item.id); },
    onSelect(item)              { console.log('selected', item.id); },
    onConnect(from, fp, to, tp) { return true; },   // return false to reject
    onDisconnect(from, fp, to, tp) {}
  };
}

// Add items
diagram.add({ ...makeItem('a', 'task'), x: 100, y: 80 });
diagram.add({ ...makeItem('b', 'task'), x: 350, y: 80 });

// Save / restore
const saved = diagram.serialize();
diagram.load(saved, (id, type) => makeItem(id, type));
</script>
```

---

## 4. Constructor & Options

```js
new FloriaDiagram(divId, options)
```

| Parameter | Type | Description |
|---|---|---|
| `divId` | `string` | `id` of the host `<div>`. Must exist in the DOM at construction time and must be **visible** (not inside a `display:none` ancestor) — JointJS requires real layout dimensions to position ports correctly. |
| `options` | `Object` | Configuration (all keys optional; defaults shown below). |

### Options reference

```js
{
  scroll: {
    x: true,          // allow horizontal overflow scroll
    y: true           // allow vertical overflow scroll
  },
  zoom: {
    min            : 0.25,   // minimum scale factor
    max            : 4,      // maximum scale factor
    wheel          : false,  // enable mouse-wheel zoom
    wheelSensitivity: 0.01   // zoom delta per wheel tick (lower = gentler)
  },
  pan                : true,   // enable drag-to-pan on blank canvas
  undo               : 50,     // undo/redo stack depth (0 = disabled)
  dimensions: {
    minW: 800,   maxW: 1200,  // container min/max width  (px)
    minH: 600,   maxH: 900    // container min/max height (px)
  },
  highlightDisconnected: true, // red outline on unconnected nodes at serialize() time
  showHelp             : true  // show keyboard shortcut hint box in bottom-right corner
}
```

**Important:** `load()` must be called **after** the host container is visible
in the viewport.  Wrap it in `setTimeout(..., 0)` when the container is made
visible in the same event loop turn (e.g. setting `display=''` before calling
`load()`).  JointJS computes port anchor geometry from live DOM dimensions; a
`display:none` ancestor reports zero dimensions and all connectors will render
at `[0,0]`.

---

## 5. The Item Contract

An **item** is a plain JavaScript object that the application creates and
passes to `diagram.add()` / `load()`.  FloriaDiagram stores it in `_items`
and uses the callbacks below to delegate rendering and event handling back to
the application.

### Required properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier within this diagram. |
| `type` | `string` | Application-defined node type (used for context menu filtering). |

### Optional properties

| Property | Type | Description |
|---|---|---|
| `x`, `y` | `number` | Initial position. Omit to auto-place at canvas centre (overlap-avoiding). |
| `ports` | `Object` | Port definition — see below. Defaults to one `in` and one `out` port. |
| `extras` | `Object` | **Application state bag.** Round-trips through `serialize`/`load` as a clean shallow copy. Keys `id`, `type`, `x`, `y` are reserved and will trigger a `console.warn` if found inside `extras`. |

### Port definition

```js
ports: {
  in : [{ id: 'in',  label: 'Input'  }],
  out: [{ id: 'out', label: 'Output' }]
}
```

Multiple in/out ports are supported.  The element height auto-scales to
accommodate the port count (`max(ports) * 25 + 30`px, minimum 60px).

### Callbacks

All callbacks are optional.  FloriaDiagram calls them if they exist.

| Callback | Signature | Notes |
|---|---|---|
| `draw(element, item)` | `(JointElement, item) → void` | Called after the item is added to the graph AND after all connectors are loaded (deferred during restore). Must be idempotent — called on every repaint/undo/redo. |
| `onEdit(item)` | `(item) → void` | Triggered by double-click or "Edit" context menu entry. |
| `onRemove(item)` | `(item) → void` | Triggered just before the item is removed from the graph. |
| `onSelect(item)` | `(item) → void` | Triggered when the item is selected (single click). |
| `onConnect(fromItem, fromPort, toItem, toPort)` | `(...) → boolean\|void` | Triggered when a new link is completed. Return `false` to reject and remove the link. |
| `onDisconnect(fromItem, fromPort, toItem, toPort)` | `(...) → void` | Triggered when a link is removed. |

---

## 6. Public API

### 6.1 Diagram lifecycle

#### `new FloriaDiagram(divId, options)`
Constructs the diagram, injects the JointJS paper into the host `<div>`, and
wires all event handlers.  Throws if the container element is not found.

#### `diagram.clear()`
Removes all items and connectors.  Saves an undo snapshot first.  No-op (with
warning) in read-only mode.  Recreates the canvas boundary after clearing.

#### `diagram.destroy()`
Tears down the diagram completely: removes context-menu DOM nodes, clears the
graph, removes the JointJS paper, empties the container, and clears all maps
and stacks.  Call when the hosting UI component is unmounted.

---

### 6.2 Item management

#### `diagram.add(item) → JointElement`
Adds an item to the diagram.

- If `item.x` / `item.y` are absent the item is placed at the canvas centre,
  shifted to avoid overlapping existing items.
- Saves an undo snapshot (unless called during a restore).
- Calls `item.draw(element, item)` immediately (unless restoring).
- Returns the JointJS `Rectangle` element.
- Throws if `item.id` is missing or already exists, or if the diagram is
  read-only and not in a restore pass.

#### `diagram.remove(id) → boolean`
Removes an item and all its connected links.  Calls `item.onRemove`.  Returns
`false` (with warning) if the id is not found or the diagram is read-only.

#### `diagram.update(id) → boolean`
Re-calls `item.draw(element, item)` on an existing item.  Use this to refresh
the visual when application state changes outside of a context-menu handler.
Returns `false` (with warning) if not found.

#### `diagram.select(id) → boolean`
Programmatically selects an item (blue outline, calls `item.onSelect`).
Clears any previous selection first.

#### `diagram.getItem(id) → item | null`
Returns the application item object for the given id, or `null`.

#### `diagram.getElement(id) → JointElement | null`
Returns the underlying JointJS element for the given id, or `null`.  Needed
when using `element.attr(...)` or `element.portProp(...)` directly from
application code.

#### `diagram.getSelectedId() → string | null`
Returns the id of the currently selected item, or `null`.

---

### 6.3 Serialisation

#### `diagram.serialize() → { items, connectors }`

Returns a plain, JSON-serialisable snapshot of the current diagram state.

```js
{
  items: [
    { id: '1', type: 'task', x: 100, y: 80, extras: { entryPoint: true } },
    ...
  ],
  connectors: [
    { from: { id: '1', port: 'out' }, to: { id: '2', port: 'in' }, vertices: [] },
    ...
  ]
}
```

- The canvas boundary rect is **not** included (it is not in `_items`).
- If `highlightDisconnected` is enabled, calling `serialize()` will visually
  mark disconnected nodes in red as a side effect — this is intentional (it is
  the "save-time validation" indicator).
- `extras` is shallow-copied; reserved keys inside it (`id`, `type`, `x`, `y`)
  trigger a `console.warn`.

#### `diagram.load(state, itemFactory, options?)`

Replaces all current content with the given state.  Clears undo/redo history.

```js
diagram.load(saved, (id, type) => makeItem(id, type), { readOnly: false });
```

| Parameter | Description |
|---|---|
| `state` | Output of `serialize()` (or equivalent JSON). |
| `itemFactory` | `function(id, type) → item` — constructs a fresh item object for each serialised entry. The factory does not need to set `id`, `type`, `x`, `y`, or `extras` — `load()` overwrites them from the saved state. |
| `options.readOnly` | If `true`, the diagram is locked after loading. |

**Timing note:** must be called after the host container is visible — see §4.

#### `diagram.deserialize(json, itemFactory)`

Lower-level variant of `load()`.  Does not accept options, does not call
`_updateInteractivity`, and does not reset `_isDisconnected` flags.  Suitable
for programmatic population outside of a user-facing restore flow.

---

### 6.4 View controls

#### `diagram.zoomIn()`
Increases zoom by `0.1`.

#### `diagram.zoomOut()`
Decreases zoom by `0.1`.

#### `diagram.resetView()`
Resets zoom to `1.0` and pan to `(0, 0)`.

#### `diagram.fullscreen(toggle?)`
Toggles fullscreen mode (fixed positioning, 100vw × 100vh, z-index 9999).
Pass `true`/`false` to force a specific state instead of toggling.  Restores
original container styles on exit.

---

### 6.5 Undo / Redo

#### `diagram.undo() → boolean`
Pops the last snapshot from the undo stack and restores it.  Pushes the
current state onto the redo stack.  Returns `false` if the stack is empty or
the diagram is read-only.

#### `diagram.redo() → boolean`
Opposite of `undo()`.

#### `diagram.getUndoRedoInfo() → { undoStack, redoStack, current }`
Returns human-readable stack summaries — useful for debugging.

```js
{
  undoStack: ['3 items, 2 links', '2 items, 1 links'],
  redoStack: [],
  current  : '3 items, 2 links'
}
```

**Keyboard shortcuts** (global, ignored when focus is in `<input>` / `<textarea>` / contenteditable):

| Key | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

---

### 6.6 Read-only mode

#### `diagram.isReadOnly() → boolean`
Returns current read-only state.

#### `diagram.setReadOnly(readOnly)`
Enables or disables read-only mode at runtime.  Adjusts JointJS interactivity,
port/link/element cursors, and adds/removes the `floria-readonly` CSS class on
the paper element.

In read-only mode:
- All item/link editing interactions are disabled.
- Pan and zoom remain fully functional.
- `add()`, `remove()`, `clear()` throw or warn.
- Context menus are suppressed.

---

### 6.7 Context menu extension

#### `diagram.registerContextMenuItem(descriptor)`

Registers a custom entry in the item right-click context menu.  Entries are
inserted after the built-in **Edit** option (before Bring to Front / Send to
Back), in registration order.

```js
diagram.registerContextMenuItem({
  id        : 'toggle-entry-point',
  itemTypes : ['agent'],               // only shown for items of type 'agent'
  name      : (item) => item.extras.entryPoint ? 'Unset as main' : 'Set as main',
  handler(item) {
    item.extras.entryPoint = !item.extras.entryPoint;
    return true;   // return true → diagram calls item.draw() to repaint
  },
  isDisabled(item) { return false; }   // optional — grey out the entry
});
```

**Descriptor fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique action key. Must not clash with built-ins: `edit`, `tofront`, `toback`, `remove`. |
| `name` | `string \| function(item)=>string` | ✅ | Menu label. If a function, evaluated on every right-click so it can reflect current item state. |
| `handler` | `function(item) => boolean\|void` | ✅ | Called on click. Return `true` to trigger `item.draw()` repaint. |
| `itemTypes` | `string[]` | — | If set, entry only appears for items whose `item.type` is in this array. |
| `isDisabled` | `function(item) => boolean` | — | Called on every right-click. Return `true` to render the entry greyed-out and non-clickable. |
| `style` | `string` | — | Inline CSS override for the `<li>` element. |

**Built-in context menu entries (always present):**

| Entry | Action |
|---|---|
| Edit | Calls `item.onEdit(item)` |
| *(separator)* | |
| Bring to Front | `element.toFront()` |
| Send to Back | `element.toBack()` |
| *(separator)* | |
| Remove | Calls `diagram.remove(id)` |

**Link context menu (built-in, not extensible):**

Right-clicking a link shows: Delete This Vertex (if near a vertex), Clear All
Vertices (if any exist), Delete Connection.  Double-clicking a link adds a
vertex at the click point.

---

## 7. Internal Methods Reference

These methods are prefixed with `_` and are not part of the public API.
They are documented here for maintainability.

### Construction & UI setup

| Method | Description |
|---|---|
| `_createControls()` | Builds the zoom +/−, reset, and fullscreen control buttons and the optional keyboard-shortcut help box. Appended to the container as absolutely-positioned overlays. |
| `_createContextMenu()` | Creates the `<ul>` shell for the item right-click menu and wires the global click-outside dismiss listener. No `<li>` items are created here — they are built dynamically on every right-click. |
| `_createLinkContextMenu()` | Creates the `<ul>` shell for the link right-click menu. Both menus are appended to `document.body` and use `position:fixed` for correct placement regardless of scroll. |
| `_setupEventHandlers()` | Wires all JointJS paper and graph events: port hover, link drag validation, link tools on hover, element click/dblclick/contextmenu/drag, vertex tracking, connection/disconnection callbacks, mouse-wheel zoom, and pan drag. |
| `_setupKeyboardShortcuts()` | Adds a global `keydown` listener for Ctrl+Z / Ctrl+Y. Ignored when an input element has focus. |

### Canvas boundary

| Method | Description |
|---|---|
| `_createCanvasBoundary()` | Draws the dashed boundary `<rect>` behind all cells. Prefers JointJS's `back` layer via `getLayerNode()` or `[data-layer="back"]` DOM query. Falls back to manually prepending a `<g>` to the paper SVG and maintaining its transform manually via `_syncBoundaryTransform()`. |
| `_removeCanvasBoundary()` | Removes the boundary rect/wrapper from the DOM and restores the default paper background colour. |
| `_syncBoundaryTransform()` | Only active in the manual-transform fallback path. Called from `_applyTransform()` to keep the boundary `<g>` in sync with zoom/pan. |

### Transform & pan

| Method | Description |
|---|---|
| `_applyTransform()` | Applies `_currentZoom` and `_panX/Y` to the JointJS paper via `scale()` and `translate()`. Also syncs the boundary transform. |
| `_setZoom(zoom)` | Clamps the zoom value to `[min, max]`, re-clamps the pan, and calls `_applyTransform()`. |
| `_clampPan(panX, panY) → {x, y}` | Keeps the canvas from being panned completely off-screen. Ensures at least `MIN_VISIBLE` (250px) of the canvas remains visible on all sides at the current zoom level. Returns unconstrained values when no `maxW`/`maxH` is set. |

### Item & graph utilities

| Method | Description |
|---|---|
| `_itemFromCellId(cellId) → item\|null` | Resolves a JointJS internal UUID to the application item via `graph.getCell(id).get('itemId')`. Used throughout event handlers to avoid repeating this two-step lookup. |
| `_createPortConfig(ports) → Object` | Builds the JointJS port configuration object from the item's `ports` definition. In-ports: small white circle (passive, left-side). Out-ports: slightly larger white circle (active magnet, right-side, crosshair cursor). |
| `_findNonOverlappingOffset(x, y, w, h) → {x, y}` | Spiral-searches outward in 8 directions (up to 20 steps of 30px each) to find a position where a new item does not overlap any existing item by more than 50% of its area. |
| `_redrawAllItems()` | Calls `item.draw(element, item)` on every item in `_items`. Used after all items and connectors are loaded so that `draw()` runs against a fully-populated graph. |
| `_clearSelection()` | Resets the selected item's stroke to default and clears `_selectedId`. |

### State persistence (undo/redo internals)

| Method | Description |
|---|---|
| `_saveState()` | Pushes a `serialize()` snapshot onto `_undoStack`. Trims the stack to `_options.undo` entries. Clears `_redoStack`. |
| `_restoreState(state)` | Restores a snapshot from the undo/redo stack. Adds/removes items as needed (calls `onRemove` for removed items), repositions surviving items, restores links, then calls `_redrawAllItems()`. Does not reset undo/redo stacks. |
| `_loadGraph(state, itemFactory)` | Shared core for both `load()` and `deserialize()`. Iterates saved items (calling `itemFactory`, applying `extras`), adds connectors, then calls `_redrawAllItems()`. Expects `_isRestoring = true` to be set by the caller. |

### Disconnected-item highlighting

| Method | Description |
|---|---|
| `_isItemConnected(itemId, links?) → boolean` | Returns `true` if the item has at least one link attached. Accepts an optional pre-fetched link array to avoid repeated `getLinks()` calls inside loops. |
| `_highlightDisconnectedItems()` | Marks all unconnected items with a red stroke (`#f44336`, width 3). Skips during restore. Called explicitly by `serialize()` to provide save-time validation feedback. |
| `_updateDisconnectedHighlights()` | Incrementally updates highlight state after a connection is added or removed. Fetches the link list once and iterates all items. |
| `_clearDisconnectedHighlight(itemId)` | Clears the `_isDisconnected` flag on one item and calls `item.draw()` to restore its normal visual style. |

### Context menus (internal)

| Method | Description |
|---|---|
| `_showContextMenu(x, y, itemId)` | Rebuilds `<ul>` contents on every invocation: filters by `itemTypes`, evaluates `isDisabled`, resolves dynamic `name` functions. Wires a single delegated `onclick` handler. Calls `adjustMenuPosition()` to keep menu within viewport. |
| `_hideContextMenu()` | Hides the menu and clears `_contextMenuTargetId`. |
| `_showLinkContextMenu(x, y, linkView, vertexIndex)` | Builds and shows the link action menu. Vertex actions only appear when relevant. |
| `_hideLinkContextMenu()` | Hides the link menu and clears the target reference. |

### Interactivity

| Method | Description |
|---|---|
| `_updateInteractivity()` | Single data-driven method that sets JointJS paper interactivity flags, port/element/link cursors, and the `floria-readonly` CSS class based on `_readOnly`. Injects the readonly CSS rule into `<head>` once if needed. |
| `_connectionExists(sourceId, sourcePort, targetId, targetPort) → boolean` | Scans all graph links to detect a duplicate connection. Used in `change:target` to prevent duplicate links from being committed. |

---

## 8. Module-level Constants

These are module-scoped (`const`) and not exported.

| Constant | Description |
|---|---|
| `LINK_STYLE` | SVG stroke attributes for all links: indigo (`#5c6bc0`), width 2, filled arrowhead. |
| `LINK_ROUTING` | JointJS router/connector config: manhattan router (step 10), rounded connector (radius 10). |
| `_STYLES` | Object containing all inline `cssText` strings used throughout the widget. Centralised so the visual design can be updated in one place. Keys: `controls`, `controlBtn`, `helpBox`, `contextMenu`, `linkContextMenu`, `menuItem`, `canvasWrapper`. |
| `_BUILT_IN_CONTEXT_MENU_ITEMS` | Array of descriptor objects for the six built-in context menu entries (Edit, separator, Bring to Front, Send to Back, separator, Remove). Each instance of `FloriaDiagram` gets a shallow copy of this array so app-registered entries are per-instance. |

---

## 9. CSS Classes & Selectors

Classes injected dynamically by the widget:

| Class | Element | When present |
|---|---|---|
| `floria-diagram-controls` | `<div>` inside container | Always — the zoom/fullscreen button bar |
| `floria-diagram-help` | `<div>` inside container | When `showHelp: true` and at least one hint is applicable |
| `floria-diagram-contextmenu` | `<ul>` on `document.body` | Always — the item right-click menu |
| `floria-diagram-link-contextmenu` | `<ul>` on `document.body` | Always — the link right-click menu |
| `floria-canvas-boundary` | SVG `<rect>` in back layer | When `dimensions.maxW` or `dimensions.maxH` is set |
| `floria-canvas-boundary-wrapper` | SVG `<g>` | Only in the manual-transform fallback path |
| `floria-pan-hover` | `_canvasWrapper` div | While pointer is over the active canvas area (pan enabled) |
| `floria-panning` | `_canvasWrapper` div | While actively dragging to pan |
| `floria-readonly` | JointJS paper `$el` | While `_readOnly === true` |

Style injected into `<head>`:

```css
/* Per-diagram (id-scoped, injected once per divId): */
#<divId>_CANVAS.floria-pan-hover > svg { cursor: grab !important; }
#<divId>_CANVAS.floria-panning > svg,
#<divId>_CANVAS.floria-panning > svg * { cursor: grabbing !important; }

/* Global (injected once across all instances): */
.floria-readonly .joint-cell { cursor: default !important; }
```

---

## 10. Architectural Decisions

### A. Item objects are application-owned
The diagram stores a reference to the item object but never mutates it except
to write back `_x` / `_y` (internal cache) and `extras` on restore.  All
visual decisions live in the application's `draw()` function.  This keeps the
widget generic and decoupled from any domain model.

### B. `draw()` is the single source of visual truth
All item styling is done inside `draw(element, item)`.  The widget never
"remembers" what colour or stroke a body had — when it needs to reset styling
(e.g. after clearing a disconnected highlight), it just calls `draw()` again.
This means `draw()` must be fully idempotent.

### C. `extras` is an isolated opaque bag
`serialize()` copies `item.extras` into the JSON as a nested `extras` key.
`load()` / `deserialize()` restore it with `item.extras = { ...s.extras }` —
a clean replacement, never merged with `Object.assign`.  This guarantees that
no key inside `extras` can accidentally overwrite `id`, `type`, `x`, or `y`
during restore.  Reserved-key violations produce a `console.warn` at
serialize time.

### D. `draw()` is deferred during restore
When `_isRestoring = true`, `add()` skips calling `draw()`.  After all items
and all connectors are in the graph, `_redrawAllItems()` calls `draw()` on
every item in one pass.  This prevents JointJS from computing port anchors
before the graph is fully populated, which was the root cause of connectors
rendering at `[0,0]` when the diagram was loaded while its container was
off-screen.

### E. Canvas boundary is a raw SVG element, not a JointJS cell
The boundary `<rect>` is injected directly into JointJS's `back` layer SVG
`<g>`.  This means the manhattan router ignores it entirely (routing cells
never treats it as an obstacle), and it requires no z-order management — the
`back` layer always renders behind all cells by design.

### F. Context menus are rebuilt on every right-click
`_showContextMenu()` clears and rebuilds the `<ul>` on every invocation.  This
makes dynamic labels (`name` as a function) and per-item disabled states
trivial to implement without any synchronisation logic.

### G. Duplicate link prevention is two-phased
During drag (`link:pointermove`), a visual `not-allowed` cursor signals the
duplicate.  The link is not removed during the drag to avoid race conditions
with JointJS's internal pointer tracking.  Removal happens in `link:pointerup`
after the drag is complete.

### H. Pan is clamped, not free
`_clampPan()` ensures a minimum of 250px of the canvas always remains visible
on every side.  This prevents the user from accidentally panning the entire
canvas out of view.  The clamp re-runs on every zoom change because the
canvas's pixel dimensions change with zoom.

---

## 11. Known Constraints & Gotchas

| # | Description |
|---|---|
| 1 | **Visibility at load time.** `load()` must be called after the container is visible. If called while `display:none`, all port positions resolve to `[0,0]` and connectors render incorrectly. Wrap in `setTimeout(..., 0)` after making the container visible. |
| 2 | **Single JointJS CDN version.** The CDN URL is hardcoded to `@joint/core@4.0.4`. Changing the version may require testing port/layer API compatibility (`getLayerNode`, `Paper.Layers.BACK`). |
| 3 | **Global keyboard shortcuts.** Ctrl+Z and Ctrl+Y are wired to `document`. Multiple `FloriaDiagram` instances on the same page will both respond. The guard (`INPUT`/`TEXTAREA`/`contenteditable`) covers most cases but not all. |
| 4 | **Global click-outside listeners.** Each instance adds a `document.addEventListener('click', ...)` for context menu dismissal. These are never removed (no cleanup in `destroy()`). For long-lived SPAs with many create/destroy cycles, consider patching `destroy()` to remove them. |
| 5 | **`_findNonOverlappingOffset` is O(N²)** in pathological cases (many items, all occupied spiral positions). Acceptable for typical diagram sizes (<100 nodes). |
| 6 | **`extras` is shallow-copied.** Nested objects inside `extras` are shared by reference after `serialize()` and restored as new shallow copies after `load()`. Deep nesting in `extras` is not recommended. |
| 7 | **`undo()` / `redo()` do not restore `extras`.** `_restoreState()` (used by undo/redo) only restores positions and links — it does not re-apply `extras` because the undo stack predates the `extras` feature. If `extras` state must be undo-able, the application should manage it separately or `_restoreState` should be extended. |
