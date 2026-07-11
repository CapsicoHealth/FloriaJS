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

/**
 * ContentExplorer — reusable two-level file-explorer-style component.
 *
 * PLUGIN API (all methods are optional; omit any you do not need)
 * ──────────────────────────────────────────────────────────────
 *   plugin.icon
 *       SVG string or <img …> HTML to use as the folder icon.
 *       Defaults to a built-in folder SVG.
 *
 *   async plugin.onList({ filter, orderBy, trashcan })  → Array<{refnum, title, lastUpdated, lastUpdatorId}>
 *       Called whenever the folder list needs to be refreshed.
 *       orderBy is 'alpha' | 'recent'.
 *
 *   async plugin.onAdd()
 *       Called when the user clicks the "+" (add folder) button.
 *
 *   async plugin.onDelete(refnum)
 *       Called when "Delete" is chosen from the folder context menu (active view).
 *
 *   async plugin.onRestore(refnum)
 *       Called when "Restore" is chosen from the folder context menu (trashcan view).
 *
 *   async plugin.onRename(refnum, newTitle)
 *       Called when "Rename" is chosen from the folder context menu (active view only).
 *
 *   async plugin.onFolderProperties(folder)  → { folders, files, totalSize }
 *       If defined, adds a "Properties" option to the folder right-click menu.
 *       The component calls this method and shows the returned statistics in a
 *       popup dialog.  Return { folders: number, files: number, totalSize: number }.
 *
 *   async plugin.onContentList(folderRefnum, { trashcan })  → Array<{refnum, …}>
 *       Called when a folder is opened.  Items are opaque to the explorer.
 *       trashcan reflects the current trashcan state so implementations can
 *       return deleted content items when true.
 *
 *   plugin.onContentRender(item)  → HTMLString
 *       Called for each content item; must return an HTML string.
 *
 *   async plugin.onContentDelete(refnum)
 *       Called when "Delete" is chosen from the content context menu (active view).
 *
 *   async plugin.onContentRestore(refnum)
 *       Called when "Restore" is chosen from the content context menu (trashcan view).
 *
 *   async plugin.onContentRename(refnum, newTitle)
 *       Called when "Rename" is chosen from the content context menu (active view only).
 *
 *   async plugin.onContentRefresh(item)
 *       Called when "Refresh" is chosen from the content context menu (active view only).
 *       If defined, a "Refresh" option will appear in the content item right-click menu.
 *
 *   plugin.onContentSelect(item)
 *       Called when the user left-clicks a content item.
 */

// ── Built-in SVG icons ────────────────────────────────────────────────────

const _SVG = {
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"
               viewBox="0 0 24 24" fill="none" stroke="#4f46e5"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
             <!-- folder body with a subtle fill so inner lines show clearly -->
             <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                   fill="#ede9fe" stroke="#4f46e5"/>
             <!-- three abstract stacked "stuff" lines inside the folder body -->
             <line x1="6"  y1="12"  x2="16" y2="12"  stroke="#7c6fd0" stroke-width="1.2" stroke-linecap="round"/>
             <line x1="6"  y1="14.5" x2="14" y2="14.5" stroke="#7c6fd0" stroke-width="1.2" stroke-linecap="round"/>
             <line x1="6"  y1="17"  x2="11" y2="17"  stroke="#7c6fd0" stroke-width="1.2" stroke-linecap="round"/>
           </svg>`,

  add: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
         </svg>`,

  // Closed trash can — lid sits flat on top, "click to view trash"
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
             <path d="M10 11v6"/><path d="M14 11v6"/>
             <rect x="3" y="4" width="18" height="3" rx="1"/>
             <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>
           </svg>`,

  // Open trash can — lid hinged open, tilted up-left at a clear angle
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

  sortAlpha: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <line x1="3" y1="6" x2="15" y2="6"/><line x1="3" y1="12" x2="10" y2="12"/>
                 <line x1="3" y1="18" x2="7" y2="18"/>
                 <polyline points="17 14 20 17 23 14"/>
                 <line x1="20" y1="6" x2="20" y2="17"/>
               </svg>`,

  sortRecent: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>`,

  back: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
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
};

// ── Helper: dismiss any open context menu ─────────────────────────────────

function _dismissMenu() {
  const existing = document.querySelector('.cex-context-menu');
  if (existing) existing.remove();
}

// Bubble phase (false) so menu-item click handlers fire first,
// then the document click closes any remaining open menu.
document.addEventListener('click', _dismissMenu, false);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _dismissMenu(); });

// ── ContentExplorer class ─────────────────────────────────────────────────

export class ContentExplorer {

  /**
   * @param {string} divId      - ID of the host element
   * @param {Object} plugin     - Plugin object (see jsdoc above)
   */
  constructor(divId, plugin = {}) {
    this._id      = divId;
    this._plugin  = plugin;
    this._plugin._parentExplorer = this; // give plugin methods access to explorer instance if needed

    // State
    this._filter       = '';
    this._orderBy      = 'alpha';   // 'alpha' | 'recent'
    this._trashcan     = false;
    this._view         = 'folders'; // 'folders' | 'contents'
    this._currentFolder = null;     // { refnum, title }

    this._folders  = [];
    this._contents = [];
  }

  // ── Public API ────────────────────────────────────────────────────────

  /** Mount and paint the explorer into the host div */
  render(backtoTop = false) {
    const host = document.getElementById(this._id);
    if (!host) throw new Error(`ContentExplorer: element #${this._id} not found`);

    if (backtoTop == true)
     {
        this._currentFolder = null;
        this._view          = 'folders';
        this._filter        = '';
     }
    host.innerHTML = '';
    host.classList.add('cex-root');

    // Build skeleton
    host.innerHTML = `
      <div class="cex-toolbar" id="${this._id}_TOOLBAR"></div>
      <div class="cex-body"    id="${this._id}_BODY"></div>
    `;

    this._renderToolbar();
    this._loadAndRender();
  }

  /** Programmatically refresh the current view */
  refresh() {
    this._loadAndRender();
  }

  getCurrentFolder() {
    return this._currentFolder;
  }

  // ── Toolbar ───────────────────────────────────────────────────────────

  _renderToolbar() {
    const tb = document.getElementById(`${this._id}_TOOLBAR`);
    if (!tb) return;
    tb.innerHTML = '';

    // ── Back button + breadcrumb (content view only) ──────────────────
    if (this._view === 'contents') {
      const backBtn = this._makeBtn('cex-back-btn', _SVG.back + ' Back', 'Go back to folder list');
      backBtn.addEventListener('click', () => this._navigateBack());
      tb.appendChild(backBtn);

      const crumb = document.createElement('span');
      crumb.className = 'cex-breadcrumb';
      crumb.title = this._currentFolder?.title || '';
      crumb.textContent = this._currentFolder?.title || '';
      tb.appendChild(crumb);
    }

    // ── Filter input ──────────────────────────────────────────────────
    const filter = document.createElement('input');
    filter.type        = 'text';
    filter.className   = 'cex-filter';
    filter.id          = `${this._id}_FILTER`;
    filter.placeholder = this._view === 'folders' ? 'Filter folders…' : 'Filter items…';
    filter.value       = this._filter;
    filter.addEventListener('input', () => {
      this._filter = filter.value;
      this._loadAndRender();
    });
    tb.appendChild(filter);

    // ── Sort toggle ───────────────────────────────────────────────────
    const sortLabel = document.createElement('span');
    sortLabel.className = 'cex-sort-label';
    sortLabel.textContent = this._orderBy === 'alpha' ? 'A–Z' : 'Recent';
    tb.appendChild(sortLabel);

    const sortBtn = this._makeIconBtn(
      this._orderBy === 'alpha' ? _SVG.sortAlpha : _SVG.sortRecent,
      this._orderBy === 'alpha' ? 'Sort by most recently changed' : 'Sort alphabetically'
    );
    sortBtn.id = `${this._id}_SORT`;
    sortBtn.addEventListener('click', () => {
      this._orderBy = this._orderBy === 'alpha' ? 'recent' : 'alpha';
      this._renderToolbar();
      this._loadAndRender();
    });
    tb.appendChild(sortBtn);

    // ── Add button (folder view, active mode only) ────────────────────
    if (this._view === 'folders' && !this._trashcan) {
      const addBtn = this._makeIconBtn(_SVG.add, 'Add new folder');
      addBtn.id = `${this._id}_ADD`;
      addBtn.addEventListener('click', async () => {
        if (this._plugin.onAdd) {
          await this._plugin.onAdd();
          this._loadAndRender();
        }
      });
      tb.appendChild(addBtn);
    }

    // ── Trashcan toggle (both folder AND content views) ───────────────
    const trashBtn = this._makeIconBtn(
      this._trashcan ? _SVG.trashOpen : _SVG.trash,
      this._trashcan ? 'Back to active items' : 'View deleted items'
    );
    trashBtn.id = `${this._id}_TRASH`;
    if (this._trashcan) trashBtn.classList.add('cex-trash-active');
    trashBtn.addEventListener('click', () => {
      this._trashcan = !this._trashcan;
      this._filter = '';
      this._renderToolbar();
      this._loadAndRender();
    });
    tb.appendChild(trashBtn);
  }

  // ── Data loading ──────────────────────────────────────────────────────

  async _loadAndRender() {
    const body = document.getElementById(`${this._id}_BODY`);
    if (!body) return;

    if (this._view === 'folders') {
      this._folders = [];
      if (this._plugin.onList) {
        try {
          this._folders = await this._plugin.onList({
            filter:   this._filter,
            orderBy:  this._orderBy,
            trashcan: this._trashcan,
          }) || [];
        } catch (e) {
          console.error('ContentExplorer: onList failed', e);
        }
      }
      this._renderFolders(body);
    } else {
      this._contents = [];
      if (this._plugin.onContentList && this._currentFolder) {
        try {
          // Pass trashcan state so plugin can return deleted content when true
          this._contents = await this._plugin.onContentList(this._currentFolder, { trashcan: this._trashcan }) || [];
        } catch (e) {
          console.error('ContentExplorer: onContentList failed', e);
        }
      }
      this._renderContents(body);
    }
  }

  // ── Folder grid ───────────────────────────────────────────────────────

  _renderFolders(body) {
    body.innerHTML = '';

    const icon = this._plugin.icon || _SVG.folder;

    let list = this._folders;
    const q = this._filter.trim().toLowerCase();
    if (q) list = list.filter(f => (f.title || '').toLowerCase().includes(q));

    if (list.length === 0) {
      let msg;
      if (q) {
        msg = `<div class="cex-empty">
                 No folders matched your filter &ldquo;<strong>${_esc(this._filter.trim())}</strong>&rdquo;.<BR>
                 Try a different search term.
               </div>
              `;
      } else if (this._trashcan) {
        msg = `<div class="cex-empty">Trash bin is empty.</div>`;
      } else {
        msg = `<div class="cex-empty cex-empty-hint">
          <p>No folders yet.</p>
          <p>Click the <strong>+</strong> button in the toolbar to create a folder,
             then click on it to open it and add content items inside.</p>
          <p>Right-click any folder to <strong>rename</strong> or <strong>delete</strong> it.</p>
        </div>`;
      }
      body.innerHTML = msg;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'cex-folder-grid';
    grid.id = `${this._id}_GRID`;

    list.forEach(folder => {
      const tile = document.createElement('div');
      tile.className = 'cex-folder-tile';
      if (this._trashcan) tile.classList.add('cex-trashed');
      tile.dataset.refnum = folder.refnum;
      tile.innerHTML = `
        <div class="cex-folder-icon">${icon}</div>
        <div class="cex-folder-title" title="${_esc(folder.title)}">${_esc(folder.title)}</div>
      `;

      // Left-click → open folder (disabled in trashcan mode)
      tile.addEventListener('click', (e) => {
        _dismissMenu();
        e.stopPropagation();
        if (!this._trashcan) this._openFolder(folder);
      });

      // Right-click → context menu
      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showFolderMenu(e, folder);
      });

      grid.appendChild(tile);
    });

    body.appendChild(grid);
  }

  _showFolderMenu(e, folder) {
    _dismissMenu();
    const menu = document.createElement('div');
    menu.className = 'cex-context-menu';

    if (this._trashcan) {
      // ── Trashcan view: Restore only ──────────────────────────────
      if (this._plugin.onRestore) {
        const restoreItem = this._makeMenuItem(_SVG.restore, 'Restore', false, 'restore');
        restoreItem.addEventListener('click', async () => {
          _dismissMenu();
          try {
            await this._plugin.onRestore(folder);
            this._loadAndRender();
          } catch (err) {
            console.error('ContentExplorer: onRestore failed', err);
          }
        });
        menu.appendChild(restoreItem);
      }
    } else {
      // ── Active view: Rename + Delete ─────────────────────────────
      if (this._plugin.onRename) {
        const renameItem = this._makeMenuItem(_SVG.rename, 'Rename', false);
        renameItem.addEventListener('click', async () => {
          _dismissMenu();
          await this._promptRename(folder, false);
        });
        menu.appendChild(renameItem);
      }

      if (this._plugin.onDelete) {
        const deleteItem = this._makeMenuItem(_SVG.deleteIcon, 'Delete', true);
        deleteItem.addEventListener('click', async () => {
          _dismissMenu();
          try {
            await this._plugin.onDelete(folder);
            this._loadAndRender();
          } catch (err) {
            console.error('ContentExplorer: onDelete failed', err);
          }
        });
        menu.appendChild(deleteItem);
      }
      if (this._plugin.onFolderProperties) {
        if (menu.children.length) {
          const sep = document.createElement('div');
          sep.className = 'cex-context-menu-sep';
          menu.appendChild(sep);
        }
        const propsItem = this._makeMenuItem(_SVG.properties, 'Properties', false);
        propsItem.addEventListener('click', async () => {
          _dismissMenu();
          this._showPropertiesDialog(folder, async () => this._plugin.onFolderProperties(folder));
        });
        menu.appendChild(propsItem);
      }
    }

    if (!menu.children.length) return;
    this._positionMenu(menu, e);
  }

  // ── Folder navigation ────────────────────────────────────────────────

  _openFolder(folder) {
    this._currentFolder = folder;
    this._view   = 'contents';
    this._filter = '';
    this._renderToolbar();
    this._loadAndRender();
  }

  _navigateBack() {
    this._currentFolder = null;
    this._view   = 'folders';
    this._filter = '';
    this._renderToolbar();
    this._loadAndRender();
  }

  // ── Content list ──────────────────────────────────────────────────────

  _renderContents(body) {
    body.innerHTML = '';

    // Apply client-side filter on any string property named 'title'
    let list = this._contents;
    const q = this._filter.trim().toLowerCase();
    if (q) list = list.filter(item => (item.title || '').toLowerCase().includes(q));

    if (list.length === 0) {
      body.innerHTML = `<div class="cex-empty">${this._trashcan ? 'No deleted items in this folder.' : 'No items found.'}</div>`;
      return;
    }

    const listEl = document.createElement('div');
    listEl.className = 'cex-content-list';
    listEl.id = `${this._id}_CONTENT_LIST`;

    list.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cex-content-row';
      row.dataset.refnum = item.refnum;

      // Delegate rendering entirely to the plugin
      if (this._plugin.onContentRender) {
        row.innerHTML = this._plugin.onContentRender(item);
      } else {
        row.innerHTML = `<div style="padding:10px 14px;">${_esc(item.title || item.refnum)}</div>`;
      }

      // Left-click → select
      row.addEventListener('click', (e) => {
        _dismissMenu();
        e.stopPropagation();
        if (this._plugin.onContentSelect) this._plugin.onContentSelect(item);
      });

      // Right-click → context menu
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showContentMenu(e, item);
      });

      listEl.appendChild(row);
    });

    body.appendChild(listEl);
  }

  _showContentMenu(e, item) {
    _dismissMenu();
    const menu = document.createElement('div');
    menu.className = 'cex-context-menu';

    if (this._trashcan) {
      // ── Trashcan view: Restore only ──────────────────────────────
      if (this._plugin.onContentRestore) {
        const restoreItem = this._makeMenuItem(_SVG.restore, 'Restore', false, 'restore');
        restoreItem.addEventListener('click', async () => {
          _dismissMenu();
          try {
            await this._plugin.onContentRestore(item);
            this._loadAndRender();
          } catch (err) {
            console.error('ContentExplorer: onContentRestore failed', err);
          }
        });
        menu.appendChild(restoreItem);
      }
    } else {
      // ── Active view: Rename + Delete ─────────────────────────────
      if (this._plugin.onContentRefresh) {
        const refreshItem = this._makeMenuItem(_SVG.refresh, 'Refresh', false);
        refreshItem.addEventListener('click', async () => {
          _dismissMenu();
          try {
            await this._plugin.onContentRefresh(item);
            this._loadAndRender();
          } catch (err) {
            console.error('ContentExplorer: onContentRefresh failed', err);
          }
        });
        menu.appendChild(refreshItem);
      }

      if (this._plugin.onContentRename) {
        const renameItem = this._makeMenuItem(_SVG.rename, 'Rename', false);
        renameItem.addEventListener('click', async () => {
          _dismissMenu();
          await this._promptRename(item, true);
        });
        menu.appendChild(renameItem);
      }

      if (this._plugin.onContentDelete) {
        const deleteItem = this._makeMenuItem(_SVG.deleteIcon, 'Delete', true);
        deleteItem.addEventListener('click', async () => {
          _dismissMenu();
          try {
            await this._plugin.onContentDelete(item);
            this._loadAndRender();
          } catch (err) {
            console.error('ContentExplorer: onContentDelete failed', err);
          }
        });
        menu.appendChild(deleteItem);
      }
    }

    if (!menu.children.length) return;
    this._positionMenu(menu, e);
  }

  // ── Rename dialog ─────────────────────────────────────────────────────

  _promptRename(item, isContent) {
    const dlg = new FloriaPromptDialog('Rename', 'Rename', async (newTitle) => {
      if (newTitle === item.title) return;
      let data = isContent ? await this._plugin.onContentRename(item, newTitle)
                           : await this._plugin.onRename(item, newTitle)
                           ;
      if (typeof data == 'string')
       return data;
      this._loadAndRender();
    }, item.title);
    return dlg.show(item.title);
  }

  // ── Properties dialog ─────────────────────────────────────────────────

  _showPropertiesDialog(folder, fetchFn) {
    const existing = document.getElementById('cex-props-dlg');
    if (existing) existing.remove();

    const title = folder.title || folder.name || folder.refnum || '';
    const dlg = document.createElement('div');
    dlg.id = 'cex-props-dlg';
    dlg.className = 'cex-props-dlg';
    dlg.innerHTML = `
      <div class="cex-props-header">
        <span class="cex-props-title">${_esc(title)} — Properties</span>
        <button class="cex-props-close" title="Close">&#x2715;</button>
      </div>
      <div class="cex-props-body cex-props-loading">
        <span class="cex-spin">${_SVG.refresh}</span> Computing…
      </div>
    `;
    document.body.appendChild(dlg);

    dlg.querySelector('.cex-props-close').addEventListener('click', () => dlg.remove());
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { dlg.remove(); document.removeEventListener('keydown', onKey); }
    });

    fetchFn().then(data => {
      const body = dlg.querySelector('.cex-props-body');
      body.classList.remove('cex-props-loading');
      const hasSubFolders = Number(data.folders) > 0 || Number(data.directFolders) > 0;
      body.innerHTML = `
        <div class="cex-props-section-label">This folder (direct contents)</div>
        <table class="cex-props-table">
          <tr><th>Sub-folders</th><td>${Number(data.directFolders).toLocaleString()}</td></tr>
          <tr><th>Files</th>      <td>${Number(data.directFiles).toLocaleString()}</td></tr>
          <tr><th>Size</th>       <td>${_formatSize(data.directSize)}</td></tr>
        </table>
        ${hasSubFolders ? `
        <div class="cex-props-section-label cex-props-section-recursive">Including all sub-folders</div>
        <table class="cex-props-table">
          <tr><th>Sub-folders</th><td>${Number(data.folders).toLocaleString()}</td></tr>
          <tr><th>Files</th>      <td>${Number(data.files).toLocaleString()}</td></tr>
          <tr><th>Total size</th> <td>${_formatSize(data.totalSize)}</td></tr>
        </table>` : ''}
      `;
    }).catch(err => {
      const body = dlg.querySelector('.cex-props-body');
      body.classList.remove('cex-props-loading');
      body.innerHTML = `<span style="color:#dc2626">Failed to load properties.</span>`;
      console.error('ContentExplorer: onFolderProperties failed', err);
    });
  }

  // ── DOM helpers ───────────────────────────────────────────────────────


  _makeIconBtn(svgHtml, title) {
    const btn = document.createElement('button');
    btn.className = 'cex-icon-btn';
    btn.title     = title;
    btn.innerHTML = svgHtml;
    return btn;
  }

  _makeBtn(className, innerHTML, title) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.title     = title;
    btn.innerHTML = innerHTML;
    return btn;
  }

  _makeMenuItem(svgHtml, label, isDanger, extraClass) {
    const item = document.createElement('div');
    item.className = 'cex-context-menu-item'
                   + (isDanger    ? ' danger'         : '')
                   + (extraClass  ? ' ' + extraClass  : '');
    item.innerHTML = svgHtml + _esc(label);
    return item;
  }

  _positionMenu(menu, mouseEvent) {
    document.body.appendChild(menu);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = mouseEvent.clientX;
    let y = mouseEvent.clientY;

    // Adjust so the menu doesn't overflow the viewport
    const mw = menu.offsetWidth  || 150;
    const mh = menu.offsetHeight || 80;
    if (x + mw > vw) x = vw - mw - 6;
    if (y + mh > vh) y = vh - mh - 6;

    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
  }
}

// ── Tiny HTML-escape helper ───────────────────────────────────────────────
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
  if (isNaN(b))         return '';
  if (b < 1024)         return b + ' B';
  if (b < 1024 * 1024)  return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3)    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}