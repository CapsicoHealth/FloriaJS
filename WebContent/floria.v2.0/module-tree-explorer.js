/* ===========================================================================
 * Copyright (C) 2025 CapsicoHealth Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

import { FloriaPromptDialog } from "./module-dialog.js";

// ── Built-in SVG icons ────────────────────────────────────────────────────

const _SVG = {

  folderClosed: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                 </svg>`,

  folderOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
                    viewBox="0 0 24 24" fill="none" stroke="#4f46e5"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                       fill="#ede9fe"/>
               </svg>`,

  expand: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="9 18 15 12 9 6"/>
           </svg>`,

  collapse: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="6 9 12 15 18 9"/>
             </svg>`,

  spinner: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                       M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>`,

  addFolder: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>`,

  addFile: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/>
              <line x1="9"  y1="15" x2="15" y2="15"/>
            </svg>`,

  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <rect x="3" y="4" width="18" height="3" rx="1"/>
            <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>
          </svg>`,

  trashOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 9l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9"/>
                <path d="M10 13v5"/><path d="M14 13v5"/>
                <line x1="4" y1="9" x2="20" y2="9"/>
                <path d="M8 9V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
                <path d="M6 7 L2 2" stroke-linecap="round"/>
                <path d="M2 2 L9 4" stroke-linecap="round"/>
              </svg>`,

  rename: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/>
           </svg>`,

  deleteIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <polyline points="3 6 5 6 21 6"/>
                 <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                 <path d="M10 11v6"/><path d="M14 11v6"/>
               </svg>`,

  restore: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74"/>
              <polyline points="3 3 3 9 9 9"/>
            </svg>`,

  refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="23 4 23 10 17 10"/>
               <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
             </svg>`,

  properties: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <circle cx="12" cy="12" r="10"/>
                 <line x1="12" y1="8" x2="12" y2="8" stroke-width="2.5"/>
                 <line x1="12" y1="12" x2="12" y2="16"/>
               </svg>`,

  prevPage: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="15 18 9 12 15 6"/>
             </svg>`,

  nextPage: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="9 18 15 12 9 6"/>
             </svg>`,
};

// ── Global context-menu dismissal ─────────────────────────────────────────

function _dismissMenu() {
  const m = document.querySelector('.tex-context-menu');
  if (m) m.remove();
}

document.addEventListener('click',   _dismissMenu, false);
document.addEventListener('keydown',  (e) => { if (e.key === 'Escape') _dismissMenu(); });

// ── TreeExplorer class ────────────────────────────────────────────────────

/**
 * TreeExplorer – a two-panel file-browser component.
 *
 * PLUGIN API (all methods optional; omit any you do not need)
 * ──────────────────────────────────────────────────────────
 *   async plugin.onListFolders(node)
 *       Returns Array<{id, name, …}> of child folder nodes.
 *       node === null means the root.
 *
 *   async plugin.onListFiles(node, {filter, orderBy, orderDir, start, size, trashcan})
 *       Returns { items: Array<{id, name, size?, lastModified?, mimeType?}>, total: number }.
 *       node === null means the root.  Implement server-side paging and
 *       filtering here for large buckets; or return all items and let the
 *       caller handle it.
 *
 *   async plugin.onAddFolder(parentNode)
 *       Called when the user clicks "Add Folder". parentNode may be null (root).
 *
 *   async plugin.onAddFile(parentNode)
 *       Called when the user clicks "Add File". parentNode may be null (root).
 *
 *   async plugin.onDeleteFolder(node)
 *       Called when "Delete" is chosen from a folder's context menu.
 *
 *   async plugin.onDeleteFile(item)
 *       Called when "Delete" is chosen from a file card's context menu.
 *
 *   async plugin.onRestoreFolder(node)
 *       Called when "Restore" is chosen in trashcan mode for a folder.
 *
 *   async plugin.onRestoreFile(item)
 *       Called when "Restore" is chosen in trashcan mode for a file.
 *
 *   async plugin.onRenameFolder(node, newName)  → string | void
 *       Called when the user renames a folder. Return an error string to
 *       reject and display an inline validation message; return nothing to accept.
 *
 *   async plugin.onRenameFile(item, newName)  → string | void
 *       Same as onRenameFolder but for a file item.
 *
   *   async plugin.onFolderProperties(node)  → { folders, files, totalSize }
 *       If defined, adds a "Properties" option to a folder's right-click menu.
 *       The component calls this method with the folder node and displays the
 *       returned counts/size in a small popup dialog.  Return
 *       { folders: number, files: number, totalSize: number }.
 *
 *   async plugin.onFileRefresh(item)
 *       If defined, adds a "Refresh" option to a file's context menu.
 *
 *   plugin.onFileSelect(item)
 *       Called when the user left-clicks a file card.
 *
 *   plugin.onFileRender(item)  → HTMLString
 *       Override the built-in file card HTML. If omitted, the default
 *       card (badge + name + size/date meta) is used.
 */
export class TreeExplorer {

  /**
   * @param {string} divId  – ID of the host element
   * @param {Object} plugin – Plugin object (see jsdoc above)
   */
  constructor(divId, plugin = {}) {
    this._id     = divId;
    this._plugin = plugin;
    this._plugin._parentExplorer = this;

    // Tree state
    this._rootNodes    = null;   // null until first load
    this._selectedNode = null;   // currently open folder (null = root)

    // Tree filter (left panel)
    this._treeFilter   = '';

    // Content state (right panel)
    this._filter       = '';
    this._orderBy      = 'name';   // 'name' | 'date' | 'size'
    this._orderDir     = 'asc';    // 'asc'  | 'desc'
    this._trashcan     = false;
    this._pageStart    = 0;
    this._pageSize     = plugin.pageSize || 50;
    this._contents     = [];
    this._contentTotal = 0;

    // Drag-resize state
    this._resizerBound = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Mount and paint the explorer into the host div. */
  render() {
    const host = document.getElementById(this._id);
    if (!host) throw new Error(`TreeExplorer: element #${this._id} not found`);
    host.innerHTML = '';
    host.classList.add('tex-root');

    host.innerHTML = `
      <div class="tex-header"           id="${this._id}_HEADER"></div>
      <div class="tex-panels">
        <div class="tex-left"           id="${this._id}_LEFT">
          <div class="tex-tree-toolbar" id="${this._id}_TREE_TB"></div>
          <div class="tex-tree-body"    id="${this._id}_TREE_BODY"></div>
        </div>
        <div class="tex-resizer"        id="${this._id}_RESIZER"></div>
        <div class="tex-right"          id="${this._id}_RIGHT">
          <div class="tex-content-toolbar" id="${this._id}_CTB"></div>
          <div class="tex-content-body"    id="${this._id}_BODY"></div>
          <div class="tex-paging"          id="${this._id}_PAGING"></div>
        </div>
      </div>
    `;

    this._renderHeader();
    this._renderTreeToolbar();
    this._renderContentToolbar();
    this._wireResizer();
    this._loadRoot();
  }

  /** Programmatically refresh the current folder's file list. */
  refresh() {
    this._loadAndRenderContent();
  }

  /**
   * Programmatically refresh the tree from a given node down.
   * Pass null to re-load the entire tree from root.
   */
  refreshTree(node = null) {
    if (node) {
      node._children = null;
      node._expanded = false;
    } else {
      this._rootNodes = null;
    }
    this._loadRoot();
  }

  /** Returns the currently selected folder node (or null for root). */
  getSelectedFolder() { return this._selectedNode; }

  // ── Resizer ────────────────────────────────────────────────────────────

  _wireResizer() {
    if (this._resizerBound) return;
    this._resizerBound = true;
    const resizerEl = document.getElementById(`${this._id}_RESIZER`);
    const leftEl    = document.getElementById(`${this._id}_LEFT`);
    if (!resizerEl || !leftEl) return;

    let dragging = false, startX = 0, startW = 0;

    resizerEl.addEventListener('mousedown', (e) => {
      dragging = true;
      startX   = e.clientX;
      startW   = leftEl.offsetWidth;
      resizerEl.classList.add('tex-resizing');
      document.body.style.cursor    = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const w = Math.max(140, Math.min(500, startW + e.clientX - startX));
      leftEl.style.width = w + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      resizerEl.classList.remove('tex-resizing');
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
    });
  }

  // ── Header (breadcrumb + trash toggle) ────────────────────────────────

  _renderHeader() {
    const el = document.getElementById(`${this._id}_HEADER`);
    if (!el) return;

    const crumbs    = this._buildBreadcrumb();
    const trashOn   = this._trashcan;

    let crumbHtml;
    if (crumbs.length === 0) {
      crumbHtml = `<span class="tex-crumb tex-crumb-current">/ (root)</span>`;
    } else {
      crumbHtml = crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return last
          ? `<span class="tex-crumb tex-crumb-current">${_esc(c.name)}</span>`
          : `<span class="tex-crumb tex-crumb-link" data-crumb-id="${_esc(c.id)}">${_esc(c.name)}</span>
             <span class="tex-crumb-sep">›</span>`;
      }).join('');
    }

    el.innerHTML = `
      <div class="tex-breadcrumb">${crumbHtml}</div>
      <div class="tex-header-actions">
        <button class="tex-icon-btn${trashOn ? ' tex-trash-active' : ''}" id="${this._id}_TRASH_BTN"
                title="${trashOn ? 'Exit trash — show active items' : 'View deleted items'}">
          ${trashOn ? _SVG.trashOpen : _SVG.trash}
        </button>
      </div>
    `;

    // Breadcrumb click-back navigation
    el.querySelectorAll('.tex-crumb-link').forEach(crumbEl => {
      crumbEl.addEventListener('click', () => {
        const id   = crumbEl.dataset.crumbId;
        const node = this._findNodeById(id);
        if (node) {
          this._selectedNode = node;
        } else {
          this._selectedNode = null;
        }
        this._pageStart = 0;
        this._filter    = '';
        this._renderHeader();
        this._renderContentToolbar();
        this._renderTreePanel();
        this._loadAndRenderContent();
      });
    });

    document.getElementById(`${this._id}_TRASH_BTN`).addEventListener('click', () => {
      this._trashcan  = !this._trashcan;
      this._pageStart = 0;
      this._renderHeader();
      this._loadAndRenderContent();
    });
  }

  _buildBreadcrumb() {
    const parts = [];
    let n = this._selectedNode;
    while (n) { parts.unshift({ id: n.id, name: n.name }); n = n._parent; }
    return parts;
  }

  _findNodeById(id) {
    if (!this._rootNodes) return null;
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n._children) { const f = walk(n._children); if (f) return f; }
      }
      return null;
    };
    return walk(this._rootNodes);
  }

  // ── Tree toolbar (folder filter) ───────────────────────────────────────

  _renderTreeToolbar() {
    const el = document.getElementById(`${this._id}_TREE_TB`);
    if (!el) return;
    el.innerHTML = `
      <input class="tex-tree-filter" id="${this._id}_TREE_FILTER"
             type="text" placeholder="Filter folders…" value="${_esc(this._treeFilter)}">
    `;
    document.getElementById(`${this._id}_TREE_FILTER`).addEventListener('input', (e) => {
      this._treeFilter = e.target.value;
      this._renderTreePanel();
    });
  }

  // ── Content toolbar (filter + sort + add + add-file) ──────────────────

  _renderContentToolbar() {
    const el = document.getElementById(`${this._id}_CTB`);
    if (!el) return;

    const sortBtns = ['name', 'date', 'size'].map(s => {
      const active = this._orderBy === s;
      const arrow  = active ? (this._orderDir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<button class="tex-sort-btn${active ? ' active' : ''}" data-sort="${s}">
                ${s.charAt(0).toUpperCase() + s.slice(1)}${arrow}
              </button>`;
    }).join('');

    const canAdd = !this._trashcan;

    el.innerHTML = `
      <input class="tex-filter" id="${this._id}_FILTER" type="text"
             placeholder="Filter files…" value="${_esc(this._filter)}">
      <div class="tex-sort-group">${sortBtns}</div>
      ${canAdd && this._plugin.onAddFolder
         ? `<button class="tex-icon-btn" id="${this._id}_ADD_FOLDER" title="New folder">${_SVG.addFolder}</button>`
         : ''}
      ${canAdd && this._plugin.onAddFile
         ? `<button class="tex-icon-btn" id="${this._id}_ADD_FILE"   title="New file">${_SVG.addFile}</button>`
         : ''}
    `;

    document.getElementById(`${this._id}_FILTER`).addEventListener('input', (e) => {
      this._filter    = e.target.value;
      this._pageStart = 0;
      this._loadAndRenderContent();
    });

    el.querySelectorAll('.tex-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.sort;
        if (this._orderBy === s) {
          this._orderDir = this._orderDir === 'asc' ? 'desc' : 'asc';
        } else {
          this._orderBy  = s;
          // Smart default: name sorts A→Z (asc) first; date/size sort highest-first (desc)
          this._orderDir = (s === 'date' || s === 'size') ? 'desc' : 'asc';
        }
        this._pageStart = 0;
        this._renderContentToolbar();
        this._loadAndRenderContent();
      });
    });

    document.getElementById(`${this._id}_ADD_FOLDER`)?.addEventListener('click', async () => {
      if (!this._plugin.onAddFolder) return;
      await this._plugin.onAddFolder(this._selectedNode);
      // Invalidate children of selected node so they reload on next expand
      if (this._selectedNode) {
        this._selectedNode._children = null;
        this._selectedNode._expanded = true;
      } else {
        this._rootNodes = null;
      }
      await this._loadRoot();
    });

    document.getElementById(`${this._id}_ADD_FILE`)?.addEventListener('click', async () => {
      if (!this._plugin.onAddFile) return;
      await this._plugin.onAddFile(this._selectedNode);
      await this._loadAndRenderContent();
    });
  }

  // ── Tree loading ───────────────────────────────────────────────────────

  async _loadRoot() {
    if (this._rootNodes !== null) {
      this._renderTreePanel();
      return;
    }
    const bodyEl = document.getElementById(`${this._id}_TREE_BODY`);
    if (bodyEl) bodyEl.innerHTML = '<div class="tex-tree-loading">Loading…</div>';

    try {
      const raw = this._plugin.onListFolders
        ? await this._plugin.onListFolders(null) || []
        : [];
      this._rootNodes = raw.map(r => this._makeNode(r, 0, null));
    } catch (e) {
      console.error('TreeExplorer: onListFolders (root) failed', e);
      this._rootNodes = [];
    }
    this._renderTreePanel();
    await this._loadAndRenderContent();
  }

  _makeNode(raw, depth, parent) {
    return {
      ...raw,
      _depth:    depth,
      _parent:   parent,
      _children: null,   // null = not yet loaded
      _expanded: false,
      _loading:  false,
    };
  }

  // ── Tree rendering ─────────────────────────────────────────────────────

  _renderTreePanel() {
    const bodyEl = document.getElementById(`${this._id}_TREE_BODY`);
    if (!bodyEl || !this._rootNodes) return;

    const q = this._treeFilter.trim().toLowerCase();

    if (q) {
      // ── Flat filtered mode ─────────────────────────────────────────
      const matches = [];
      const walk = (nodes) => {
        for (const n of nodes) {
          if (n.name.toLowerCase().includes(q)) matches.push(n);
          if (n._children) walk(n._children);
        }
      };
      walk(this._rootNodes);

      if (matches.length === 0) {
        bodyEl.innerHTML = '<div class="tex-empty" style="font-size:12px;padding:1em;">No folders matched.</div>';
        return;
      }
      bodyEl.innerHTML = '';
      const listEl = document.createElement('div');
      listEl.className = 'tex-tree-flat-list';
      matches.forEach(node => {
        const row = document.createElement('div');
        const sel = this._selectedNode === node;
        row.className = 'tex-node-row' + (sel ? ' tex-node-selected' : '');
        row.innerHTML = `
          <span class="tex-node-icon">${sel ? _SVG.folderOpen : _SVG.folderClosed}</span>
          <span class="tex-node-label" title="${_esc(this._buildNodePath(node))}">${_esc(this._buildNodePath(node))}</span>
        `;
        row.addEventListener('click', () => this._selectFolder(node));
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this._showFolderMenu(e, node); });
        listEl.appendChild(row);
      });
      bodyEl.appendChild(listEl);
      return;
    }

    // ── Normal tree view ───────────────────────────────────────────────
    const flat = this._flattenVisible();
    if (flat.length === 0) {
      bodyEl.innerHTML = '<div class="tex-empty" style="font-size:12px;padding:1em;">No folders yet.</div>';
      return;
    }

    bodyEl.innerHTML = '';
    const wrap = document.createElement('div');

    flat.forEach(node => {
      const isLeaf     = node._children !== null && node._children.length === 0;
      const isExpanded = node._expanded;
      const isSelected = this._selectedNode === node;

      const row = document.createElement('div');
      row.className = 'tex-node-row' + (isSelected ? ' tex-node-selected' : '');
      row.style.paddingLeft = (8 + node._depth * 16) + 'px';

      let expandHtml;
      if (node._loading) {
        expandHtml = `<span class="tex-expand-icon tex-loading-spin">${_SVG.spinner}</span>`;
      } else if (isLeaf) {
        expandHtml = `<span class="tex-expand-icon tex-expand-leaf"></span>`;
      } else {
        expandHtml = `<span class="tex-expand-icon">${isExpanded ? _SVG.collapse : _SVG.expand}</span>`;
      }

      row.innerHTML = `
        ${expandHtml}
        <span class="tex-node-icon">${isSelected ? _SVG.folderOpen : _SVG.folderClosed}</span>
        <span class="tex-node-label" title="${_esc(node.name)}">${_esc(node.name)}</span>
      `;

      // Expand/collapse: click only the arrow
      row.querySelector('.tex-expand-icon')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!node._loading && !isLeaf) this._toggleExpand(node);
      });

      // Select folder + auto-expand on row click
      row.addEventListener('click', (e) => {
        _dismissMenu();
        this._selectFolder(node);
        if (!node._expanded && !isLeaf) this._toggleExpand(node);
      });

      // Right-click context menu
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        this._showFolderMenu(e, node);
      });

      wrap.appendChild(row);
    });

    bodyEl.appendChild(wrap);

    // Scroll selected node into view (no jumping)
    const selRow = bodyEl.querySelector('.tex-node-selected');
    if (selRow) selRow.scrollIntoView({ block: 'nearest' });
  }

  _buildNodePath(node) {
    const parts = [];
    let n = node;
    while (n) { parts.unshift(n.name); n = n._parent; }
    return parts.join(' › ');
  }

  _flattenVisible() {
    const flat = [];
    const walk = (nodes) => {
      for (const n of nodes) {
        flat.push(n);
        if (n._expanded && n._children) walk(n._children);
      }
    };
    if (this._rootNodes) walk(this._rootNodes);
    return flat;
  }

  async _toggleExpand(node) {
    if (node._expanded) {
      node._expanded = false;
      this._renderTreePanel();
      return;
    }
    if (node._children === null) {
      node._loading = true;
      this._renderTreePanel();
      try {
        const raw = this._plugin.onListFolders
          ? await this._plugin.onListFolders(node) || []
          : [];
        node._children = raw.map(r => this._makeNode(r, node._depth + 1, node));
      } catch (e) {
        console.error('TreeExplorer: onListFolders failed', e);
        node._children = [];
      }
      node._loading = false;
    }
    node._expanded = true;
    this._renderTreePanel();
  }

  async _selectFolder(node) {
    this._selectedNode = node;
    this._pageStart    = 0;
    this._filter       = '';
    this._renderHeader();
    this._renderContentToolbar();
    this._renderTreePanel();
    await this._loadAndRenderContent();
  }

  // ── Content loading and rendering ─────────────────────────────────────

  async _loadAndRenderContent() {
    const bodyEl = document.getElementById(`${this._id}_BODY`);
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="tex-loading">Loading files…</div>';

    try {
      let result = { items: [], total: 0 };
      if (this._plugin.onListFiles) {
        result = await this._plugin.onListFiles(this._selectedNode, {
          filter:   this._filter,
          orderBy:  this._orderBy,
          orderDir: this._orderDir,
          start:    this._pageStart,
          size:     this._pageSize,
          trashcan: this._trashcan,
        }) || { items: [], total: 0 };
      }
      this._contents     = result.items || [];
      this._contentTotal = result.total != null ? result.total : this._contents.length;
    } catch (e) {
      console.error('TreeExplorer: onListFiles failed', e);
      this._contents     = [];
      this._contentTotal = 0;
    }

    this._renderContent();
    this._renderPaging();
  }

  _renderContent() {
    const bodyEl = document.getElementById(`${this._id}_BODY`);
    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    if (this._selectedNode === null && this._contents.length === 0 && !this._filter) {
      bodyEl.innerHTML = `
        <div class="tex-empty tex-empty-hint">
          <p>Select a folder in the tree on the left to view its files.</p>
          <p>Right-click any folder to <strong>rename</strong> or <strong>delete</strong> it.</p>
        </div>`;
      return;
    }

    if (this._contents.length === 0) {
      const msg = this._trashcan ? 'No deleted files in this folder.'
                : this._filter   ? `No files matched &ldquo;<strong>${_esc(this._filter.trim())}</strong>&rdquo;.`
                :                  'This folder is empty.';
      bodyEl.innerHTML = `<div class="tex-empty">${msg}</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'tex-file-grid';
    grid.id = `${this._id}_GRID`;

    this._contents.forEach(item => {
      const card = document.createElement('div');
      card.className = 'tex-file-card' + (item._deleted ? ' tex-trashed' : '');
      card.dataset.id = item.id;

      card.innerHTML = this._plugin.onFileRender
        ? this._plugin.onFileRender(item)
        : this._defaultFileCard(item);

      card.addEventListener('click', (e) => {
        _dismissMenu();
        e.stopPropagation();
        if (this._plugin.onFileSelect) this._plugin.onFileSelect(item);
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        this._showFileMenu(e, item);
      });

      grid.appendChild(card);
    });

    bodyEl.appendChild(grid);
  }

  _defaultFileCard(item) {
    const { bg, fg, label } = _fileTypeMeta(item.mimeType, item.name);
    const size = _formatSize(item.size);
    const date = _formatDate(item.lastModified);
    const meta = [size, date].filter(Boolean).join(' · ');
    return `
      <div class="tex-file-badge" style="background:${bg};color:${fg}">${_esc(label)}</div>
      <div class="tex-file-info">
        <div class="tex-file-name" title="${_esc(item.name || item.id)}">${_esc(item.name || item.id)}</div>
        <div class="tex-file-meta">${_esc(meta)}</div>
      </div>
    `;
  }

  _renderPaging() {
    const el = document.getElementById(`${this._id}_PAGING`);
    if (!el) return;

    if (this._contentTotal === 0) { el.innerHTML = ''; return; }

    const from    = this._pageStart + 1;
    const to      = Math.min(this._pageStart + this._pageSize, this._contentTotal);
    const hasPrev = this._pageStart > 0;
    const hasNext = to < this._contentTotal;

    el.innerHTML = `
      <button class="tex-page-btn" id="${this._id}_PREV" ${hasPrev ? '' : 'disabled'}>
        ${_SVG.prevPage} Prev
      </button>
      <span class="tex-page-info">${from}–${to} of ${this._contentTotal} file${this._contentTotal !== 1 ? 's' : ''}</span>
      <button class="tex-page-btn" id="${this._id}_NEXT" ${hasNext ? '' : 'disabled'}>
        Next ${_SVG.nextPage}
      </button>
    `;

    document.getElementById(`${this._id}_PREV`)?.addEventListener('click', () => {
      this._pageStart = Math.max(0, this._pageStart - this._pageSize);
      this._loadAndRenderContent();
    });
    document.getElementById(`${this._id}_NEXT`)?.addEventListener('click', () => {
      this._pageStart += this._pageSize;
      this._loadAndRenderContent();
    });
  }

  // ── Context menus ──────────────────────────────────────────────────────

  _showFolderMenu(e, node) {
    _dismissMenu();
    const menu = document.createElement('div');
    menu.className = 'tex-context-menu';

    if (this._trashcan) {
      if (this._plugin.onRestoreFolder) {
        const mi = this._makeMenuItem(_SVG.restore, 'Restore', false, 'restore');
        mi.addEventListener('click', async () => {
          _dismissMenu();
          try { await this._plugin.onRestoreFolder(node); this._renderTreePanel(); }
          catch (err) { console.error('TreeExplorer: onRestoreFolder failed', err); }
        });
        menu.appendChild(mi);
      }
    } else {
      if (this._plugin.onRenameFolder) {
        const mi = this._makeMenuItem(_SVG.rename, 'Rename', false);
        mi.addEventListener('click', () => { _dismissMenu(); this._promptRename(node, false); });
        menu.appendChild(mi);
      }
      if (this._plugin.onDeleteFolder) {
        const mi = this._makeMenuItem(_SVG.deleteIcon, 'Delete', true);
        mi.addEventListener('click', async () => {
          _dismissMenu();
          try {
            await this._plugin.onDeleteFolder(node);
            // Remove from parent's child list
            if (node._parent) {
              node._parent._children = node._parent._children?.filter(n => n !== node) || null;
            } else {
              this._rootNodes = this._rootNodes?.filter(n => n !== node) || [];
            }
            if (this._selectedNode === node) {
              this._selectedNode = node._parent || null;
              this._renderHeader();
              await this._loadAndRenderContent();
            }
            this._renderTreePanel();
          } catch (err) { console.error('TreeExplorer: onDeleteFolder failed', err); }
        });
        menu.appendChild(mi);
      }
      if (this._plugin.onFolderProperties) {
        if (menu.children.length) {
          const sep = document.createElement('div');
          sep.className = 'tex-context-menu-sep';
          menu.appendChild(sep);
        }
        const mi = this._makeMenuItem(_SVG.properties, 'Properties', false);
        mi.addEventListener('click', async () => {
          _dismissMenu();
          this._showPropertiesDialog(node, async () => this._plugin.onFolderProperties(node));
        });
        menu.appendChild(mi);
      }
    }

    if (!menu.children.length) return;
    this._positionMenu(menu, e);
  }

  _showFileMenu(e, item) {
    _dismissMenu();
    const menu = document.createElement('div');
    menu.className = 'tex-context-menu';

    if (this._trashcan) {
      if (this._plugin.onRestoreFile) {
        const mi = this._makeMenuItem(_SVG.restore, 'Restore', false, 'restore');
        mi.addEventListener('click', async () => {
          _dismissMenu();
          try { await this._plugin.onRestoreFile(item); await this._loadAndRenderContent(); }
          catch (err) { console.error('TreeExplorer: onRestoreFile failed', err); }
        });
        menu.appendChild(mi);
      }
    } else {
      if (this._plugin.onFileRefresh) {
        const mi = this._makeMenuItem(_SVG.refresh, 'Refresh', false);
        mi.addEventListener('click', async () => {
          _dismissMenu();
          try { await this._plugin.onFileRefresh(item); await this._loadAndRenderContent(); }
          catch (err) { console.error('TreeExplorer: onFileRefresh failed', err); }
        });
        menu.appendChild(mi);
      }
      if (this._plugin.onRenameFile) {
        const mi = this._makeMenuItem(_SVG.rename, 'Rename', false);
        mi.addEventListener('click', () => { _dismissMenu(); this._promptRename(item, true); });
        menu.appendChild(mi);
      }
      if (this._plugin.onDeleteFile) {
        const mi = this._makeMenuItem(_SVG.deleteIcon, 'Delete', true);
        mi.addEventListener('click', async () => {
          _dismissMenu();
          try { await this._plugin.onDeleteFile(item); await this._loadAndRenderContent(); }
          catch (err) { console.error('TreeExplorer: onDeleteFile failed', err); }
        });
        menu.appendChild(mi);
      }
    }

    if (!menu.children.length) return;
    this._positionMenu(menu, e);
  }

  // ── Rename dialog ──────────────────────────────────────────────────────

  _promptRename(item, isFile) {
    const dlg = new FloriaPromptDialog('Rename', 'Rename', async (newName) => {
      if (!newName || newName === item.name) return;
      const fn = isFile ? this._plugin.onRenameFile : this._plugin.onRenameFolder;
      if (fn) {
        const err = await fn(item, newName);
        if (typeof err === 'string') return err;
      }
      item.name = newName;
      if (isFile) this._renderContent();
      else { this._renderTreePanel(); this._renderHeader(); }
    }, item.name);
    return dlg.show(item.name);
  }

  // ── Properties dialog ──────────────────────────────────────────────────

  _showPropertiesDialog(node, fetchFn) {
    const existing = document.getElementById('tex-props-dlg');
    if (existing) existing.remove();

    const dlg = document.createElement('div');
    dlg.id = 'tex-props-dlg';
    dlg.className = 'tex-props-dlg';
    dlg.innerHTML = `
      <div class="tex-props-header">
        <span class="tex-props-title">${_esc(node.name)} — Properties</span>
        <button class="tex-props-close" title="Close">&#x2715;</button>
      </div>
      <div class="tex-props-body tex-props-loading">
        <span class="tex-loading-spin">${_SVG.spinner}</span> Computing…
      </div>
    `;
    document.body.appendChild(dlg);

    dlg.querySelector('.tex-props-close').addEventListener('click', () => dlg.remove());
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { dlg.remove(); document.removeEventListener('keydown', onKey); }
    });

    fetchFn().then(data => {
      const body = dlg.querySelector('.tex-props-body');
      body.classList.remove('tex-props-loading');
      // Show direct children (matches what the content pane / paging shows),
      // then recursive totals in a clearly separated section.
      const hasSubFolders = Number(data.folders) > 0 || Number(data.directFolders) > 0;
      body.innerHTML = `
        <div class="tex-props-section-label">This folder (direct contents)</div>
        <table class="tex-props-table">
          <tr><th>Sub-folders</th><td>${Number(data.directFolders).toLocaleString()}</td></tr>
          <tr><th>Files</th>      <td>${Number(data.directFiles).toLocaleString()}</td></tr>
          <tr><th>Size</th>       <td>${_formatSize(data.directSize)}</td></tr>
        </table>
        ${hasSubFolders ? `
        <div class="tex-props-section-label tex-props-section-recursive">Including all sub-folders</div>
        <table class="tex-props-table">
          <tr><th>Sub-folders</th><td>${Number(data.folders).toLocaleString()}</td></tr>
          <tr><th>Files</th>      <td>${Number(data.files).toLocaleString()}</td></tr>
          <tr><th>Total size</th> <td>${_formatSize(data.totalSize)}</td></tr>
        </table>` : ''}
      `;
    }).catch(err => {
      const body = dlg.querySelector('.tex-props-body');
      body.classList.remove('tex-props-loading');
      body.innerHTML = `<span style="color:#dc2626">Failed to load properties.</span>`;
      console.error('TreeExplorer: onFolderProperties failed', err);
    });
  }

  // ── DOM helpers ────────────────────────────────────────────────────────

  _makeMenuItem(svgHtml, label, isDanger, extraClass) {
    const item = document.createElement('div');
    item.className = 'tex-context-menu-item'
                   + (isDanger   ? ' danger'       : '')
                   + (extraClass ? ' ' + extraClass : '');
    item.innerHTML = svgHtml + _esc(label);
    return item;
  }

  _positionMenu(menu, mouseEvent) {
    document.body.appendChild(menu);
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = mouseEvent.clientX, y = mouseEvent.clientY;
    const mw = menu.offsetWidth || 160, mh = menu.offsetHeight || 80;
    if (x + mw > vw) x = vw - mw - 6;
    if (y + mh > vh) y = vh - mh - 6;
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
  }
}

// ── Standalone helpers ────────────────────────────────────────────────────

function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _formatSize(bytes) {
  if (bytes == null || bytes === '') return '';
  const b = Number(bytes);
  if (isNaN(b))        return '';
  if (b < 1024)        return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3)   return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}

function _formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Returns { bg, fg, label } for a file type badge.
 * @param {string} mimeType
 * @param {string} name
 */
export function _fileTypeMeta(mimeType, name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const m   = (mimeType || '').toLowerCase();

  if (m === 'application/pdf'  || ext === 'pdf')
    return { bg: '#fee2e2', fg: '#dc2626', label: 'PDF' };
  if (m.includes('jpeg') || ext === 'jpg' || ext === 'jpeg')
    return { bg: '#dbeafe', fg: '#2563eb', label: 'JPG' };
  if (m.includes('png')  || ext === 'png')
    return { bg: '#dcfce7', fg: '#16a34a', label: 'PNG' };
  if (m.includes('gif')  || ext === 'gif')
    return { bg: '#ede9fe', fg: '#7c3aed', label: 'GIF' };
  if (m.includes('bmp')  || ext === 'bmp')
    return { bg: '#fef3c7', fg: '#d97706', label: 'BMP' };
  if (m.includes('zip')  || ext === 'zip')
    return { bg: '#f1f5f9', fg: '#475569', label: 'ZIP' };

  const lbl = ext ? ext.toUpperCase().slice(0, 4) : 'FILE';
  return { bg: '#f3f4f6', fg: '#6b7280', label: lbl };
}
