# TreeExplorer

A **two-panel, plugin-driven file browser** component for FloriaJS.

The left panel shows a **lazy-loading folder tree** that expands as the user navigates.  
The right panel shows **file cards** (name, size, date, type badge) for the selected folder,
with filtering, multi-column sorting, paging, and a trashcan mode.

> **Relates to:** `module-content-explorer.js` — `ContentExplorer` is a flat two-level
> folder→content browser well suited to app-level resource lists. `TreeExplorer` targets
> deep, arbitrary-depth hierarchies (e.g. cloud-storage buckets) where the tree structure
> itself is part of the navigation experience.

---

## Quick Start

```html
<!-- 1. Import CSS (once per page, before the component is mounted) -->
<link rel="stylesheet" href="/floria.v2.0/module-tree-explorer.css">

<!-- 2. Host element -->
<div id="myExplorer" style="height:600px;"></div>

<!-- 3. Mount -->
<script type="module">
  import { TreeExplorer } from '/floria.v2.0/module-tree-explorer.js';

  const explorer = new TreeExplorer('myExplorer', myPlugin);
  explorer.render();
</script>
```

---

## Plugin API

All methods are **optional**. Omit any capability you do not need — the component
gracefully hides or disables the associated UI element.

### Folder methods

| Method | Signature | Description |
|---|---|---|
| `onListFolders` | `async (node) → Array<{id, name, …}>` | Returns child folder nodes. `node === null` means root. Called lazily when a node is first expanded. |
| `onAddFolder` | `async (parentNode)` | Called when the user clicks **Add Folder**. `parentNode` may be `null` (root). Implement the creation; the component will reload the affected tree level. |
| `onDeleteFolder` | `async (node)` | Called when **Delete** is chosen from a folder's context menu. The node is removed from the local tree immediately after. |
| `onRestoreFolder` | `async (node)` | Called when **Restore** is chosen in trashcan mode. |
| `onRenameFolder` | `async (node, newName) → string\|void` | Called when the user confirms a rename. Return an error string to reject and show an inline message; return nothing to accept. |

### File methods

| Method | Signature | Description |
|---|---|---|
| `onListFiles` | `async (node, opts) → {items, total}` | Returns `{ items: FileItem[], total: number }`. `node === null` means root. `opts` carries `{filter, orderBy, orderDir, start, size, trashcan}`. Implement server-side paging and filtering for large folders. |
| `onAddFile` | `async (parentNode)` | Called when the user clicks **Add File**. |
| `onDeleteFile` | `async (item)` | Called when **Delete** is chosen from a file card's context menu. |
| `onRestoreFile` | `async (item)` | Called when **Restore** is chosen in trashcan mode. |
| `onRenameFile` | `async (item, newName) → string\|void` | Same semantics as `onRenameFolder`. |
| `onFileRefresh` | `async (item)` | If defined, adds a **Refresh** option to a file's context menu. |
| `onFileSelect` | `(item)` | Called when the user left-clicks a file card (e.g. to open a preview). |
| `onFileRender` | `(item) → HTMLString` | Override the built-in card HTML for a single file item. |

### FileItem shape

```js
{
  id:           string,   // unique identifier (e.g. GCS object path)
  name:         string,   // display filename
  size:         number,   // bytes (optional)
  lastModified: string,   // ISO 8601 date (optional)
  mimeType:     string,   // MIME type (optional; drives the type badge colour)
  // any extra fields are preserved and passed back to plugin methods
}
```

### Node shape (after wrapping)

The objects passed back into plugin callbacks are the raw objects returned by
`onListFolders`, augmented with internal state fields (prefixed `_`):

```js
{
  id:         string,   // from your data
  name:       string,   // from your data
  // … any extra raw fields …
  _depth:     number,   // 0 = root level
  _parent:    node|null,
  _children:  node[]|null,  // null = not yet loaded
  _expanded:  boolean,
  _loading:   boolean,
}
```

---

## Public API

```js
const explorer = new TreeExplorer(divId, plugin);

explorer.render();              // Mount/re-mount the component.
explorer.refresh();             // Reload current folder's file list.
explorer.refreshTree(node);     // Reload tree from a node downwards.
                                // Pass null to reload from root.
explorer.getSelectedFolder();   // Returns the current folder node (or null for root).
```

---

## CSS Custom Properties

Override these on the host element or a parent to adjust layout:

```css
#myExplorer {
  --tex-tree-width: 260px;   /* default left-panel width (user can drag to resize) */
}
```

---

## Sorting and Paging

`onListFiles` receives:

| Parameter | Type | Description |
|---|---|---|
| `filter` | string | Current text from the content filter input. |
| `orderBy` | `'name'` \| `'date'` \| `'size'` | Active sort column. |
| `orderDir` | `'asc'` \| `'desc'` | Sort direction. |
| `start` | number | Zero-based offset for the current page. |
| `size` | number | Maximum number of items to return (default 50). |
| `trashcan` | boolean | Whether trashcan mode is active. |

For **small** data sources (dozens of files), you can ignore paging:

```js
async onListFiles(node, { filter, orderBy, orderDir }) {
  let items = await fetchAll(node.id);
  if (filter) items = items.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
  items.sort( /* orderBy / orderDir */ );
  return { items, total: items.length };   // return ALL at once
}
```

For **large** data sources (hundreds or thousands of files), implement server-side
paging and pass back the true `total` so the component renders correct paging controls:

```js
async onListFiles(node, { filter, orderBy, orderDir, start, size }) {
  const resp = await fetch(`/api/bucket-list?path=${node.id}&filter=${filter}
                            &sort=${orderBy}&dir=${orderDir}&start=${start}&size=${size}`);
  return await resp.json();  // { items: [...], total: 1234 }
}
```

---

## Connecting to a GCS Bucket (Java / Servlet example)

The plugin is the bridge between the component and any backend. Below is the
minimal frontend wiring for a servlet that wraps `CSHelper`:

```js
const plugin = {
  async onListFolders(node) {
    const path = node ? node.id : '';
    const r = await fetch(`/svc/bucket/folders?path=${encodeURIComponent(path)}`);
    return (await r.json()).folders;  // [{ id, name }, …]
  },

  async onListFiles(node, opts) {
    const params = new URLSearchParams({
      path:    node ? node.id : '',
      filter:  opts.filter,
      orderBy: opts.orderBy,
      dir:     opts.orderDir,
      start:   opts.start,
      size:    opts.size,
    });
    const r = await fetch(`/svc/bucket/files?${params}`);
    return await r.json();   // { items: […], total: N }
  },

  onFileSelect(item) {
    // e.g. open a signed-URL preview
    fetch(`/svc/bucket/signed-url?path=${encodeURIComponent(item.id)}`)
      .then(r => r.json())
      .then(d => window.open(d.url, '_blank'));
  },
};

new TreeExplorer('myExplorer', plugin).render();
```

---

## Trashcan Mode

Toggle the **trash icon** (top-right of the header bar) to enter trashcan mode.
In this mode:

- `onListFiles` receives `trashcan: true` so you can return soft-deleted items.
- File and folder context menus replace **Delete** with **Restore**.
- **Add Folder** and **Add File** buttons are hidden.

---

## Built-in File Type Badges

The default card renderer colours badges automatically from `mimeType` or filename extension:

| Type | Background | Text | Triggers |
|---|---|---|---|
| PDF | red-50 | red-600 | `application/pdf`, `.pdf` |
| JPG | blue-100 | blue-600 | `image/jpeg`, `.jpg`, `.jpeg` |
| PNG | green-100 | green-600 | `image/png`, `.png` |
| GIF | violet-100 | violet-700 | `image/gif`, `.gif` |
| BMP | amber-100 | amber-600 | `image/bmp`, `.bmp` |
| ZIP | slate-100 | slate-600 | `application/zip`, `.zip` |
| Other | gray-100 | gray-500 | extension uppercased, up to 4 chars |

You can override entirely via `plugin.onFileRender(item) → HTMLString`.

---

## Demo

See [`module-tree-explorer-demo.html`](./module-tree-explorer-demo.html) for a
fully self-contained demo using local JSON data (no server required).
