# FloriaTable — `module-tables.js`

> A modern fixed-header, sortable, filterable table component for displaying
> fixed-size datasets (hundreds to thousands of rows) inside any host `<div>`.  
> Plain vanilla ES module — no external dependencies.  
> Import with `import { FloriaTable } from '.../module-tables.js'`.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Dependencies](#2-dependencies)
3. [Quick Start](#3-quick-start)
4. [Constructor](#4-constructor)
5. [Column Meta-data](#5-column-meta-data)
   - [Field reference](#51-field-reference)
   - [Types](#52-types)
   - [Text wrapping (`wrap`)](#53-text-wrapping-wrap)
   - [Column widths (`minWidth` / `maxWidth`)](#54-column-widths-minwidth--maxwidth)
   - [Built-in renderers](#55-built-in-renderers)
   - [Custom renderer functions](#56-custom-renderer-functions)
6. [Public API](#6-public-api)
7. [Generated DOM & ID Namespacing](#7-generated-dom--id-namespacing)
8. [CSS Classes Reference](#8-css-classes-reference)
9. [Filtering Behaviour](#9-filtering-behaviour)
10. [Sorting Behaviour](#10-sorting-behaviour)
11. [Multiple Tables on the Same Page](#11-multiple-tables-on-the-same-page)
12. [Known Constraints & Tips](#12-known-constraints--tips)

---

## 1. Overview

`FloriaTable` renders a dataset as an HTML `<table>` that:

| Feature | Detail |
|---|---|
| Fixed header | `<thead>` is `position:sticky` so it stays visible while the body scrolls |
| Scrollable body | The table body scrolls independently inside the parent `<div>` |
| Filter bar | Live text filter above the header; multi-term AND matching across all columns |
| Column sorting | Click any sortable column header to sort asc/desc; indicator updates in place |
| Cell renderers | Built-in renderers for date, datetime, number; fully customisable via a function |
| Text wrapping | Per-column `wrap` property: `'clip'` (ellipsis, default for strings), `'wrap'`, or `'pre'` |
| Wide table | `wideTable=true` constructor flag enables x-scrolling for wide datasets |
| Column widths | `minWidth` / `maxWidth` per column applied to both `<th>` and `<td>` |
| No infinite scroll | Data is rendered in one pass; optimised for ≤ ~5 000 rows |
| No external deps | Pure vanilla JS & CSS; reuses `FloriaDate` for date parsing only |

---

## 2. Dependencies

| Dependency | Role |
|---|---|
| `module-date.js` (`FloriaDate`) | Date/datetime parsing and formatting |
| `module-tables.css` | All component styles (must be linked in the page) |

```html
<link rel="stylesheet" href="/static/floria.v2.0/module-tables.css">
```

---

## 3. Quick Start

```html
<link rel="stylesheet" href="/static/floria.v2.0/module-tables.css">

<!-- The host div — give it an explicit height so the body can scroll -->
<div id="myTable" style="height:500px;"></div>

<script type="module">
import { FloriaTable } from '/static/floria.v2.0/module-tables.js';

const columns = [
  { field: 'name',  label: 'Name',   sortable: true, type: 'string'                                   },
  { field: 'dob',   label: 'DOB',    sortable: true, type: 'date'                                      },
  { field: 'score', label: 'Score',  sortable: true, type: 'number', renderer: "number(1)"             },
  { field: 'active',label: 'Active',                 type: 'boolean'                                   },
  // string-ml with explicit widths and pre-wrap behaviour
  { field: 'notes', label: 'Notes',                  type: 'string-ml',
    wrap: 'pre', minWidth: '200px', maxWidth: '400px'                                                   }
];

const data = [
  { name: 'Alice', dob: '1990-03-12', score: 98.6, active: true,  notes: 'Line 1\nLine 2' },
  { name: 'Bob',   dob: '1985-07-22', score: 72.0, active: false, notes: '' }
];

// enableFilter=true (default), wideTable=false (default — fits parent width)
const table = new FloriaTable('myTable', columns, data);
table.render();

// Wide table example (enables x-scrolling):
// const table = new FloriaTable('myTable', columns, data, true, true);
</script>
```

---

## 4. Constructor

```js
new FloriaTable(parentDivId, columns, data [, enableFilter = true [, wideTable = false]])
```

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parentDivId` | `string` | ✓ | — | `id` of the host `<div>`. The div must exist in the DOM when `render()` is called. Give it an explicit height (px, vh, %, etc.) so the table body can scroll. |
| `columns` | `Array<ColumnDef>` | ✓ | — | Ordered array of column meta-data objects (see §5). |
| `data` | `Array<Object>` | ✓ | — | Array of plain data objects. May be empty (`[]`). |
| `enableFilter` | `boolean` | | `true` | When `true`, renders a live text-filter bar above the header. Pass `false` to hide it. |
| `wideTable` | `boolean` | | `false` | When `true`, the table uses `width: max-content` and the body wrapper gets `overflow-x: auto`, enabling horizontal scrolling for tables with many columns. Combine with `minWidth` / `maxWidth` on columns for precise control. |

---

## 5. Column Meta-data

Each element of the `columns` array is a plain object:

```js
{
  field    : 'lastName',          // required
  label    : 'Last Name',         // required
  sortable : true,                // default: false
  align    : 'left',              // default: see §5.1
  type     : 'string',            // default: 'string'
  renderer : "number(2)",         // optional — string spec or function (§5.5/§5.6)
  wrap     : 'clip',              // optional — 'clip'|'wrap'|'pre' (§5.3)
  minWidth : '150px',             // optional — CSS min-width (§5.4)
  maxWidth : '400px'              // optional — CSS max-width (§5.4)
}
```

### 5.1 Field reference

| Property | Type | Default | Description |
|---|---|---|---|
| `field` | `string` | — | Key name on each data object. Supports only a single-level property name (no dot-paths). |
| `label` | `string` | — | Text shown in the column header. |
| `sortable` | `boolean` | `false` | Adds a sort-toggle widget to the header. Click once → ascending; click again → descending. |
| `align` | `'left'` \| `'right'` \| `'center'` | auto | Applies to both the header cell and all data cells. Defaults to `'right'` for `integer` and `number` types; `'left'` for everything else. |
| `type` | see §5.2 | `'string'` | Informs default alignment, default renderer, default wrap, and sort comparator. |
| `renderer` | `string` \| `function` | — | Override cell rendering. See §5.5 and §5.6. |
| `wrap` | `'clip'` \| `'wrap'` \| `'pre'` | see §5.3 | Controls text-overflow behaviour for both header and data cells. |
| `minWidth` | `string` | — | CSS `min-width` value (e.g. `'120px'`, `'10rem'`). Applied to `<th>` and `<td>` as an inline style. |
| `maxWidth` | `string` | — | CSS `max-width` value (e.g. `'300px'`). Applied to `<th>` and `<td>` as an inline style. Particularly useful with `wrap:'clip'` to cap how wide a clipped column grows. |

### 5.2 Types

| `type` value | Description | Default alignment | Default wrap | Sort order |
|---|---|---|---|---|
| `'string'` | Single-line text | left | `'clip'` | lexicographic |
| `'string-ml'` | Multi-line / long text | left | `'clip'`* | lexicographic |
| `'integer'` | Whole number | right | `'wrap'` | numeric |
| `'number'` | Floating-point | right | `'wrap'` | numeric |
| `'date'` | Date value (parsed by `FloriaDate`) | left | `'wrap'` | chronological |
| `'datetime'` | Date+time value | left | `'wrap'` | chronological |
| `'boolean'` | `true` / `false` | center | `'wrap'` | — |

> \* `string-ml` defaults to `'clip'` just like `string`. Set `wrap: 'pre'` explicitly to restore pre-wrap
> multi-line behaviour, and combine with `minWidth`/`maxWidth` to give the column enough room.

### 5.3 Text wrapping (`wrap`)

The `wrap` property controls how a cell handles text that would otherwise overflow.  
It is applied as a CSS class (`ftbl-wrap-clip`, `ftbl-wrap-wrap`, `ftbl-wrap-pre`) to both `<th>` and `<td>`.

| Value | CSS effect | Typical use |
|---|---|---|
| `'clip'` | `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` | **Default for `string` and `string-ml`**. Keeps the table compact; long values are truncated with `…`. |
| `'wrap'` | `white-space:normal; word-break:break-word` | **Default for all other types**. Lets the cell grow vertically. |
| `'pre'` | `white-space:pre-wrap; word-break:break-word` | Preserves newlines and whitespace. Use for multi-line string data (e.g. notes fields). |

**Best practice for `string-ml` columns with real multi-line content:**
```js
{ field: 'notes', label: 'Notes', type: 'string-ml',
  wrap: 'pre', minWidth: '180px', maxWidth: '360px' }
```

### 5.4 Column widths (`minWidth` / `maxWidth`)

Both `minWidth` and `maxWidth` accept any valid CSS length string.  They are applied as
inline `style` attributes on both the `<th>` and `<td>` for that column.

```js
// Guarantee the Name column is at least 160px, but never more than 280px
{ field: 'name', label: 'Name', sortable: true, type: 'string',
  minWidth: '160px', maxWidth: '280px' }

// In a wideTable, give each string-ml column an explicit floor
{ field: 'description', label: 'Description', type: 'string-ml',
  wrap: 'pre', minWidth: '240px' }
```

> **Note:** `maxWidth` alone is sufficient to trigger ellipsis clipping when `wrap:'clip'` is active.
> Without a `maxWidth`, a `'clip'` column still prevents wrapping but will grow with the table layout.
> In a `wideTable`, columns grow to content width by default — `minWidth`/`maxWidth` give you explicit control.

### 5.5 Built-in renderers

A renderer string is parsed at construction time.  The syntax is
`name(arg)` where `arg` is a plain value without mandatory quotes.

| Renderer string | Produces |
|---|---|
| `"date('short')"` | `YYYY-MM-DD` via `FloriaDate.printYYYYMMDD()` |
| `"date('long')"` | Human-friendly date via `FloriaDate.printFriendly()` |
| `"datetime('short')"` | `YYYY-MM-DD HH:MM:SS` |
| `"datetime('long')"` | Friendly date + `HH:MM:SS` |
| `"number(N)"` | `toFixed(N)` — e.g. `"number(2)"` for two decimals |

> **Type-defaults:** When `type` is `'date'`, `'datetime'`, or `'boolean'` and no `renderer`
> is specified, the short-format renderer (or boolean check/cross) is applied automatically.

### 5.6 Custom renderer functions

Pass any `function(row) → htmlString` for complete control:

```js
{
  field: 'status',
  label: 'Status',
  renderer: function(row) {
    const colour = row.status === 'OK' ? '#16a34a' : '#dc2626';
    return `<span style="color:${colour};font-weight:600">${row.status}</span>`;
  }
}
```

The function receives the **entire row object** so it can combine multiple fields.  
It must return a safe HTML string (escape user data with `&amp;`, `&lt;` etc.).  
Return an empty string to let the component show the standard `—` placeholder.

---

## 6. Public API

### `render()`

Builds and inserts the full table HTML into the host `<div>`, then wires up
filter and sort event listeners.  Call once after construction.

```js
table.render();
```

> Re-calling `render()` rebuilds the entire widget from scratch, which is
> rarely needed.  Use `setData()` instead for data refreshes.

---

### `setData(data)`

Replaces the data array, resets the sort state, re-applies the current
filter text, and redraws the rows.  The column configuration and filter
input value are preserved.

```js
table.setData(newDataArray);
```

| Parameter | Type | Description |
|---|---|---|
| `data` | `Array<Object>` | New dataset. Pass `[]` to clear. |

---

## 7. Generated DOM & ID Namespacing

All generated element IDs are derived from `parentDivId` to guarantee
uniqueness when multiple `FloriaTable` instances exist on the same page.

| Generated ID | Element | Notes |
|---|---|---|
| `{id}_FLT` | `<input>` | Filter text input |
| `{id}_CNT` | `<span>` | "shown / total rows" counter |
| `{id}_BODY` | `<div>` | Scrollable body wrapper |
| `{id}_TBL` | `<table>` | The table element |
| `{id}_HEAD` | `<thead>` | Header; single `click` listener drives all column sorting |
| `{id}_BODY_TBL` | `<tbody>` | Data rows |

---

## 8. CSS Classes Reference

All rules are scoped under `.ftbl-root` (automatically added to the host `<div>`).

| Class | Element | Purpose |
|---|---|---|
| `.ftbl-root` | host `<div>` | Flex-column container; `height:100%` |
| `.ftbl-filterbar` | `<div>` | Filter bar background + padding |
| `.ftbl-filter-input` | `<input>` | Styled text input with focus ring |
| `.ftbl-filter-count` | `<span>` | "N / M rows" label |
| `.ftbl-body` | `<div>` | Scroll container (`overflow-y:auto; overflow-x:auto`) |
| `.ftbl-body.ftbl-wide` | `<div>` | Adds `overflow-x:auto`; table uses `width:max-content` to enable horizontal scrolling |
| `.ftbl-table` | `<table>` | `border-collapse:collapse; width:100%` (or `max-content` in wide mode) |
| `.ftbl-sortable` | `<th>` | Cursor pointer + hover tint |
| `.ftbl-sort-asc` | `<th>` | Active ascending sort indicator |
| `.ftbl-sort-desc` | `<th>` | Active descending sort indicator |
| `.ftbl-sort-icon` | `<span>` inside `<th>` | ⇅ / ▲ / ▼ indicator |
| `.ftbl-th-inner` | `<span>` inside `<th>` | Flex row: label + icon |
| `.ftbl-align-left` | `<th>`, `<td>` | `text-align:left` |
| `.ftbl-align-right` | `<th>`, `<td>` | `text-align:right` |
| `.ftbl-align-center` | `<th>`, `<td>` | `text-align:center` |
| `.ftbl-wrap-clip` | `<th>`, `<td>` | `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` — auto-applied to `string`/`string-ml` |
| `.ftbl-wrap-wrap` | `<th>`, `<td>` | `white-space:normal; word-break:break-word` — auto-applied to numeric, date, boolean |
| `.ftbl-wrap-pre` | `<th>`, `<td>` | `white-space:pre-wrap; word-break:break-word` — explicit opt-in for multi-line text |
| `.ftbl-bool-true` | `<span>` | Green ✓ |
| `.ftbl-bool-false` | `<span>` | Red ✗ |
| `.ftbl-empty` | `<td>` | Centred "No matching records" message |
| `.ftbl-multiline` | `<td>` | Legacy alias for `ftbl-wrap-pre` (kept for backwards compatibility) |

---

## 9. Filtering Behaviour

- The filter bar is shown by default (`enableFilter = true`).
- Filtering is **case-insensitive**.
- Multiple space-separated terms are treated as **AND** — all terms must
  appear somewhere in the row.
- Matching is performed against the **raw data values** of every column
  concatenated into a single string; it does not test rendered HTML.
- Non-matching rows receive `display:none` at the `<tr>` level via
  `innerHTML` regeneration of `<tbody>` (not DOM toggling), which keeps
  the implementation fast for large datasets.
- The row count badge (`{id}_CNT`) updates on every keystroke.
- Sorting is applied before filtering; the sort order is preserved when
  the filter text changes.

---

## 10. Sorting Behaviour

- Only columns with `sortable: true` show the sort widget.
- A single `click` event listener is attached to `<thead>` and uses
  `data-sortcol` on each `<th>` to identify the target column — there
  is exactly **one** event handler regardless of column count.
- Clicking a non-active sortable column → ascending sort on that column.
- Clicking the currently active column → toggles direction.
- Sort mutates the internal `_data` array in place (native `Array.sort`).
- After a sort, the filter is re-applied so the visible set remains consistent.
- `setData()` resets the sort to the original insertion order.

**Sort comparators by type:**

| Type | Comparator |
|---|---|
| `integer` | `parseInt` numeric |
| `number` | `parseFloat` numeric |
| `date` / `datetime` | `FloriaDate.parseDateTime().getTime()` |
| `string` / `string-ml` / `boolean` | `toLowerCase()` lexicographic |
| `null` / `undefined` values | Sorted to the bottom in ascending order |

---

## 11. Multiple Tables on the Same Page

Because every generated ID is prefixed with `parentDivId`, you can render
as many `FloriaTable` instances as needed:

```js
const t1 = new FloriaTable('tablePatients', colsPat, dataPat);
const t2 = new FloriaTable('tableOrders',   colsOrd, dataOrd, false);
t1.render();
t2.render();
```

Each table maintains its own independent filter state, sort state, and DOM.

---

## 12. Known Constraints & Tips

| Topic | Notes |
|---|---|
| Host div height | The host `<div>` **must** have a defined height (e.g. `height:400px`, `height:60vh`, or a flex/grid parent that constrains it). Without a height the sticky header has nothing to stick to and the body won't scroll. |
| Dataset size | Tested comfortably up to ~5 000 rows. For very large sets (10 000+) consider server-side pagination or virtualisation. |
| Dot-path fields | `field` must be a direct property name. Nested paths like `"address.city"` are not supported — flatten data before passing it in. |
| Custom renderer XSS | Renderer functions return raw HTML. Always HTML-escape any user-supplied values you include. |
| Re-render vs setData | Calling `render()` a second time destroys and rebuilds the widget. Prefer `setData()` to update data without losing the current filter text. |
| CSS customisation | Override CSS custom properties or add rules after `.ftbl-root` selectors. All rules are scoped so there is no bleed to other components. |
| `boolean` sort | Boolean columns are compared lexicographically (`'true'` / `'false'`) which is generally not meaningful; mark `sortable: false` unless the semantics suit your data. |
| `wrap:'clip'` without `maxWidth` | The column still prevents text from wrapping, but without a `maxWidth` the column will grow as wide as its widest value before clipping. Add `maxWidth` to cap column width and consistently show the ellipsis. |
| `wideTable` + sticky header | Sticky `<thead>` works correctly in wide-table mode — the header scrolls horizontally along with the body because both share the same scrolling ancestor (`.ftbl-body`). |
| `string-ml` multi-line data | By default `string-ml` now clips (same as `string`). Set `wrap:'pre'` to restore newline-preserving display, and supply `minWidth` so the column has enough room to be readable. |
